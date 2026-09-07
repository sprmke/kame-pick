import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '#/db'
import { candidateNotes, emailMessages } from '#/db/schema'
import type { CandidateNote, EmailMessage } from '#/lib/types'
import { loadCriteria } from '#/server/candidates'
import { getCandidate } from '#/server/candidates'
import { getGmailServiceForUser, gmailStatus } from '#/server/gmail-oauth'

const TEMPLATE_PATH = join(process.cwd(), 'config/shortlist-email-template.txt')
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g

export function renderTemplate(text: string, context: Record<string, string>) {
  return text.replace(PLACEHOLDER_RE, (_, key: string) => context[key.toLowerCase()] ?? _)
}

async function baseEmailContext(orgId: string) {
  const criteria = await loadCriteria(orgId)
  return {
    team_name: process.env.RECRUITER_TEAM_NAME?.trim() || 'Hiring Team',
    role: String(criteria.role ?? 'AI-Assisted Web Developer'),
  }
}

export async function candidateEmailContext(orgId: string, slug: string) {
  const candidate = await getCandidate(orgId, slug)
  if (!candidate) throw new Error('Candidate not found')
  const name = candidate.name || slug
  return {
    ...(await baseEmailContext(orgId)),
    name,
    email: candidate.email,
    slug,
    first_name: name.split(' ')[0] || slug,
  }
}

export function getDefaultEmailTemplate() {
  const body = readFileSync(TEMPLATE_PATH, 'utf-8').trim()
  return {
    body,
    placeholders: ['first_name', 'name', 'email', 'role', 'team_name'],
    team_name: process.env.RECRUITER_TEAM_NAME?.trim() || 'Hiring Team',
    role: 'AI-Assisted Web Developer',
  }
}

function rowToEmail(row: typeof emailMessages.$inferSelect): EmailMessage {
  return {
    id: row.id,
    slug: row.slug,
    analysis_run_id: row.analysisRunId,
    gmail_message_id: row.gmailMessageId,
    gmail_thread_id: row.gmailThreadId,
    direction: row.direction,
    from_email: row.fromEmail,
    to_email: row.toEmail,
    subject: row.subject,
    body_text: row.bodyText,
    sent_at: row.sentAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    status: row.status,
    error: row.error,
  }
}

export async function listEmailMessages(orgId: string, slug: string, analysisRunId?: number) {
  const db = getDb()
  const rows = await db.query.emailMessages.findMany({
    where: analysisRunId
      ? and(
          eq(emailMessages.organizationId, orgId),
          eq(emailMessages.slug, slug),
          eq(emailMessages.analysisRunId, analysisRunId),
        )
      : and(eq(emailMessages.organizationId, orgId), eq(emailMessages.slug, slug)),
    orderBy: [emailMessages.sentAt, emailMessages.id],
  })
  return rows.map(rowToEmail)
}

export async function insertEmailMessage(
  orgId: string,
  data: Omit<EmailMessage, 'id' | 'created_at'> & { created_at?: string },
) {
  const db = getDb()
  const [row] = await db
    .insert(emailMessages)
    .values({
      organizationId: orgId,
      slug: data.slug,
      analysisRunId: data.analysis_run_id,
      gmailMessageId: data.gmail_message_id,
      gmailThreadId: data.gmail_thread_id,
      direction: data.direction,
      fromEmail: data.from_email,
      toEmail: data.to_email,
      subject: data.subject,
      bodyText: data.body_text,
      sentAt: new Date(data.sent_at),
      status: data.status,
      error: data.error,
    })
    .returning()
  return rowToEmail(row!)
}

export async function getEmailThread(orgId: string, slug: string, analysisRunId?: number) {
  const candidate = await getCandidate(orgId, slug)
  const messages = await listEmailMessages(orgId, slug, analysisRunId)
  const meta = candidate?.metadata ?? {}
  const hasOutbound = messages.some((m) => m.direction === 'outbound' && m.status === 'sent')
  const inbound: EmailMessage[] = []
  if (!analysisRunId && candidate?.email_text) {
    inbound.push({
      id: `inbound-${slug}`,
      slug,
      analysis_run_id: null,
      gmail_message_id: null,
      gmail_thread_id: null,
      direction: 'inbound',
      from_email: candidate.email,
      to_email: '',
      subject: candidate.subject,
      body_text: candidate.email_text,
      sent_at: candidate.received_at ?? new Date().toISOString(),
      status: 'received',
      error: null,
      source: 'sync',
    } as EmailMessage)
  }
  return {
    slug,
    analysis_run_id: analysisRunId ?? null,
    candidate_email: candidate?.email ?? '',
    default_subject: candidate?.subject ? `Re: ${candidate.subject.replace(/^Re:\s*/i, '')}` : '',
    gmail_thread_id: (meta.gmail_thread_id as string) ?? null,
    has_outbound: hasOutbound,
    messages: [...inbound, ...messages],
  }
}

export async function getRunEmailActivity(orgId: string, runId: number) {
  const db = getDb()
  const rows = await db.query.emailMessages.findMany({
    where: and(eq(emailMessages.organizationId, orgId), eq(emailMessages.analysisRunId, runId)),
    orderBy: [emailMessages.sentAt, emailMessages.id],
  })
  const messages = rows.map(rowToEmail)
  const bySlug: Record<string, EmailMessage[]> = {}
  for (const m of messages) {
    ;(bySlug[m.slug] ??= []).push(m)
  }
  return {
    analysis_run_id: runId,
    total_sent: messages.filter((m) => m.direction === 'outbound' && m.status === 'sent').length,
    messages,
    by_slug: bySlug,
  }
}

export async function previewCandidateEmail(
  orgId: string,
  slug: string,
  subject: string,
  body: string,
  reply = true,
) {
  const ctx = await candidateEmailContext(orgId, slug)
  if (!ctx.email) throw new Error('Candidate has no email address on file')
  let subjectRendered = renderTemplate(subject, ctx)
  const bodyRendered = renderTemplate(body, ctx)
  const candidate = await getCandidate(orgId, slug)
  if (reply && candidate?.subject) {
    subjectRendered = subjectRendered.startsWith('Re:') ? subjectRendered : `Re: ${subjectRendered.replace(/^Re:\s*/i, '')}`
  }
  return { to_email: ctx.email, to_name: ctx.name, subject: subjectRendered, body: bodyRendered }
}

function normalizeSubjectForReply(subject: string) {
  return subject.startsWith('Re:') ? subject : `Re: ${subject.replace(/^Re:\s*/i, '')}`
}

export async function sendCandidateEmail(
  orgId: string,
  userId: string,
  slug: string,
  subject: string,
  body: string,
  analysisRunId?: number,
  reply = true,
) {
  const preview = await previewCandidateEmail(orgId, slug, subject, body, reply)
  const gmail = await getGmailServiceForUser(orgId, userId)
  const raw = [
    `To: ${preview.to_email}`,
    `Subject: ${preview.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    preview.body,
  ].join('\r\n')
  const encoded = Buffer.from(raw).toString('base64url')
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  })
  const sentAt = new Date().toISOString()
  const profile = await gmail.users.getProfile({ userId: 'me' })
  const record = await insertEmailMessage(orgId, {
    slug,
    analysis_run_id: analysisRunId ?? null,
    gmail_message_id: res.data.id ?? null,
    gmail_thread_id: res.data.threadId ?? null,
    direction: 'outbound',
    from_email: profile.data.emailAddress ?? '',
    to_email: preview.to_email,
    subject: preview.subject,
    body_text: preview.body,
    sent_at: sentAt,
    status: 'sent',
    error: null,
  })
  const db = getDb()
  await db
    .insert(candidateNotes)
    .values({
      organizationId: orgId,
      slug,
      status: 'shortlisted',
      starred: false,
      notes: '',
      tags: [],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [candidateNotes.organizationId, candidateNotes.slug],
      set: { status: 'shortlisted', updatedAt: new Date() },
    })
  return { ok: true, message: record, status_updated: true }
}

export async function sendBatchEmails(
  orgId: string,
  userId: string,
  slugs: string[],
  subject: string,
  body: string,
  analysisRunId?: number,
  reply = true,
) {
  const db = getDb()
  const contacted = await db
    .selectDistinct({ slug: emailMessages.slug })
    .from(emailMessages)
    .where(
      and(
        eq(emailMessages.organizationId, orgId),
        inArray(emailMessages.slug, slugs),
        eq(emailMessages.direction, 'outbound'),
        eq(emailMessages.status, 'sent'),
      ),
    )
  const already = new Set(contacted.map((r) => r.slug))
  const results: Array<Record<string, unknown>> = []
  let sent = 0
  let failed = 0
  let skipped = 0
  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i]!
    if (already.has(slug)) {
      skipped++
      results.push({ slug, ok: false, skipped: true, error: 'Initial email already sent' })
      continue
    }
    if (i > 0) await new Promise((r) => setTimeout(r, 600))
    try {
      const outcome = await sendCandidateEmail(orgId, userId, slug, subject, body, analysisRunId, reply)
      sent++
      results.push({ slug, ...outcome })
    } catch (e) {
      failed++
      results.push({ slug, ok: false, error: String(e) })
    }
  }
  return { total: slugs.length, sent, failed, skipped, results }
}

export async function gmailSendReady(orgId: string, userId: string) {
  return gmailStatus(orgId, userId)
}

export { normalizeSubjectForReply }
