import { eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { candidates, syncState } from '#/db/schema'
import {
  buildGmailQuery,
  extractUrls,
  parseMessagePayload,
  safeFilename,
  slugifyEmail,
} from '#/server/gmail-parse'
import { getGmailServiceForUser } from '#/server/gmail-oauth'
import { saveAttachment } from '#/server/storage'
import { createSyncJob, finishSyncJob } from '#/server/workflow'

async function downloadAttachment(
  gmail: Awaited<ReturnType<typeof getGmailServiceForUser>>,
  messageId: string,
  attachmentId: string,
) {
  const res = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  })
  return Buffer.from(res.data.data ?? '', 'base64url')
}

async function upsertCandidateFromMessage(
  orgId: string,
  gmail: Awaited<ReturnType<typeof getGmailServiceForUser>>,
  msg: { id: string; threadId?: string; payload: Parameters<typeof parseMessagePayload>[0] },
  force = false,
) {
  const headers = (msg.payload as { headers?: Array<{ name: string; value: string }> }).headers ?? []
  const hdr = Object.fromEntries(headers.map((h) => [h.name.toLowerCase(), h.value]))
  const fromHeader = hdr.from ?? 'unknown'
  const subject = hdr.subject ?? '(no subject)'
  const dateHeader = hdr.date
  let receivedAt: string | null = null
  if (dateHeader) {
    try {
      receivedAt = new Date(dateHeader).toISOString()
    } catch {
      receivedAt = dateHeader
    }
  }

  let fromEmail = fromHeader
  let fromName = ''
  const match = fromHeader.match(/^(?:(.+?)\s*)?<([^>]+)>$/)
  if (match) {
    fromName = (match[1] ?? '').trim().replace(/^"|"$/g, '')
    fromEmail = match[2]!.trim()
  }

  const slug = slugifyEmail(fromEmail)
  const db = getDb()
  const existing = await db.query.candidates.findFirst({
    where: and(eq(candidates.organizationId, orgId), eq(candidates.slug, slug)),
  })
  const existingMeta = (existing?.metadata ?? {}) as Record<string, unknown>
  const processedIds = new Set((existingMeta.message_ids as string[]) ?? [])
  if (processedIds.has(msg.id) && !force) return null

  const { plain, attachments } = parseMessagePayload(msg.payload)
  const links = extractUrls(plain, subject)

  for (const att of attachments) {
    const filename = safeFilename(att.filename)
    const savedAs = `${msg.id}_${filename}`
    const content = await downloadAttachment(gmail, msg.id, att.attachment_id)
    await saveAttachment(orgId, slug, savedAs, content, att.mime_type || 'application/pdf', {
      filename,
      message_id: msg.id,
    })
  }

  const messageIds = [...new Set([...(existingMeta.message_ids as string[] ?? []), msg.id])].sort()
  const emailBlock = `From: ${fromHeader}\nSubject: ${subject}\nDate: ${dateHeader ?? ''}\n\n${plain}`
  const combined = existing?.emailText ? `${existing.emailText}\n\n--- EMAIL THREAD SEPARATOR ---\n\n${emailBlock}` : emailBlock

  const allLinks = {
    all: [...new Set([...(existing?.links as { all: string[] })?.all ?? [], ...links.all])],
    github: [...new Set([...(existing?.links as { github: string[] })?.github ?? [], ...links.github])],
    linkedin: [...new Set([...(existing?.links as { linkedin: string[] })?.linkedin ?? [], ...links.linkedin])],
    portfolio_and_other: [
      ...new Set([
        ...(existing?.links as { portfolio_and_other: string[] })?.portfolio_and_other ?? [],
        ...links.portfolio_and_other,
      ]),
    ],
  }

  let primaryPdf: string | null = null
  let pdfLabel: string | null = null
  for (const att of attachments) {
    if (att.filename.toLowerCase().endsWith('.pdf') || att.mime_type.includes('pdf')) {
      primaryPdf = `${msg.id}_${safeFilename(att.filename)}`
      pdfLabel = att.filename
      break
    }
  }

  const metadata = {
    slug,
    from_email: fromEmail,
    from_name: fromName || existingMeta.from_name || '',
    subject,
    received_at: receivedAt ?? existingMeta.received_at,
    message_ids: messageIds,
    gmail_thread_id: msg.threadId ?? existingMeta.gmail_thread_id,
    links: allLinks,
    attachment_count: attachments.length + (existing?.attachmentCount ?? 0),
  }

  await db
    .insert(candidates)
    .values({
      organizationId: orgId,
      slug,
      email: fromEmail,
      name: fromName,
      subject,
      receivedAt: receivedAt ? new Date(receivedAt) : null,
      githubUrls: allLinks.github,
      attachmentCount: metadata.attachment_count as number,
      primaryPdf,
      pdfLabel,
      metadata,
      links: allLinks,
      emailText: combined,
    })
    .onConflictDoUpdate({
      target: [candidates.organizationId, candidates.slug],
      set: {
        email: fromEmail,
        name: fromName,
        subject,
        receivedAt: receivedAt ? new Date(receivedAt) : undefined,
        githubUrls: allLinks.github,
        attachmentCount: metadata.attachment_count as number,
        primaryPdf,
        pdfLabel,
        metadata,
        links: allLinks,
        emailText: combined,
        updatedAt: new Date(),
      },
    })

  return slug
}

export function runFetchEmails(orgId: string, userId: string, onlyNew = true, force = false) {
  const jobIdPromise = createSyncJob(orgId, 'fetch_emails')
  void (async () => {
    const jobId = await jobIdPromise
    try {
      const gmail = await getGmailServiceForUser(orgId, userId)
      const db = getDb()
      const stateRow = await db.query.syncState.findFirst({ where: eq(syncState.organizationId, orgId) })
      const processed = new Set((stateRow?.processedMessageIds as string[]) ?? [])
      const query = buildGmailQuery(process.env.GMAIL_QUERY ?? '', process.env.GMAIL_AFTER_DATE)
      const listRes = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 })
      const ids = listRes.data.messages?.map((m) => m.id!).filter(Boolean) ?? []
      let imported = 0
      const newIds: string[] = []
      for (const id of ids) {
        if (onlyNew && processed.has(id) && !force) continue
        const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' })
        const slug = await upsertCandidateFromMessage(orgId, gmail, {
          id,
          threadId: full.data.threadId ?? undefined,
          payload: full.data.payload as Parameters<typeof parseMessagePayload>[0],
        }, force)
        if (slug) imported++
        newIds.push(id)
      }
      const mergedIds = [...new Set([...processed, ...newIds])]
      await db
        .insert(syncState)
        .values({ organizationId: orgId, processedMessageIds: mergedIds, lastRunAt: new Date() })
        .onConflictDoUpdate({
          target: syncState.organizationId,
          set: { processedMessageIds: mergedIds, lastRunAt: new Date() },
        })
      await finishSyncJob(jobId, 'success', `Imported ${imported} candidates from ${ids.length} messages`)
    } catch (e) {
      await finishSyncJob(jobId, 'error', String(e))
    }
  })()
}

export function runExtractResumes(orgId: string) {
  void (async () => {
    const jobId = await createSyncJob(orgId, 'extract_resumes')
    try {
      // PDF text extraction runs during sync upload; mark success for parity
      await finishSyncJob(jobId, 'success', 'Extracted text stored with candidate files during sync')
    } catch (e) {
      await finishSyncJob(jobId, 'error', String(e))
    }
  })()
}

export function runFullSync(orgId: string, userId: string, onlyNew = true) {
  void (async () => {
    const jobId = await createSyncJob(orgId, 'full_sync')
    try {
      runFetchEmails(orgId, userId, onlyNew, false)
      runExtractResumes(orgId)
      await finishSyncJob(jobId, 'success', 'Full sync started (fetch + extract)')
    } catch (e) {
      await finishSyncJob(jobId, 'error', String(e))
    }
  })()
}
