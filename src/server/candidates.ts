import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '#/db'
import {
  analysisRuns,
  candidateFiles,
  candidateNotes,
  candidates,
  jobCriteria,
  syncJobs,
} from '#/db/schema'
import { loadDefaultCriteria, scoreCandidateText } from '#/server/scorer'
import type {
  CandidateFull,
  CandidateListItem,
  CandidateNote,
  DashboardData,
  JobCriteriaData,
} from '#/lib/types'
import { parse as parseYaml } from 'yaml'

export async function loadCriteria(orgId: string): Promise<Record<string, unknown>> {
  const db = getDb()
  const row = await db.query.jobCriteria.findFirst({
    where: eq(jobCriteria.organizationId, orgId),
  })
  if (row?.content) {
    return parseYaml(row.content) as Record<string, unknown>
  }
  return loadDefaultCriteria()
}

export async function getJobCriteriaResponse(orgId: string): Promise<JobCriteriaData> {
  const db = getDb()
  const row = await db.query.jobCriteria.findFirst({
    where: eq(jobCriteria.organizationId, orgId),
  })
  if (!row) {
    const raw = await import('node:fs/promises').then((fs) =>
      fs.readFile(new URL('../../config/job-criteria.yaml', import.meta.url), 'utf-8'),
    )
    return { raw, parsed: parseYaml(raw) as Record<string, unknown> }
  }
  return { raw: row.content, parsed: parseYaml(row.content) as Record<string, unknown> }
}

export async function saveJobCriteria(orgId: string, content: string) {
  const db = getDb()
  await db
    .insert(jobCriteria)
    .values({ organizationId: orgId, content })
    .onConflictDoUpdate({
      target: jobCriteria.organizationId,
      set: { content, updatedAt: new Date() },
    })
}

async function getNotesMap(orgId: string): Promise<Map<string, CandidateNote>> {
  const db = getDb()
  const rows = await db.query.candidateNotes.findMany({
    where: eq(candidateNotes.organizationId, orgId),
  })
  const map = new Map<string, CandidateNote>()
  for (const row of rows) {
    map.set(row.slug, {
      slug: row.slug,
      status: row.status,
      starred: row.starred,
      notes: row.notes,
      tags: row.tags as string[],
      updated_at: row.updatedAt?.toISOString(),
    })
  }
  return map
}

function combinedText(candidate: {
  emailText: string
  metadata: Record<string, unknown>
}, extracted: string[]): string {
  const parts = [candidate.emailText, ...extracted]
  const meta = candidate.metadata as { resume_text?: string }
  if (meta.resume_text) parts.push(meta.resume_text)
  return parts.filter(Boolean).join('\n\n')
}

export async function getDashboard(orgId: string): Promise<DashboardData> {
  const db = getDb()
  const allCandidates = await db.query.candidates.findMany({
    where: eq(candidates.organizationId, orgId),
  })
  const notes = await getNotesMap(orgId)
  const runs = await db.query.analysisRuns.findMany({
    where: eq(analysisRuns.organizationId, orgId),
  })
  const latestSync = await db.query.syncJobs.findFirst({
    where: eq(syncJobs.organizationId, orgId),
    orderBy: [desc(syncJobs.id)],
  })
  const criteria = await loadCriteria(orgId)

  const statusCounts: Record<string, number> = {}
  let starred = 0
  for (const note of notes.values()) {
    statusCounts[note.status] = (statusCounts[note.status] ?? 0) + 1
    if (note.starred) starred++
  }

  const updatedAt = allCandidates.reduce<Date | null>((max, c) => {
    const t = c.updatedAt
    return !max || t > max ? t : max
  }, null)

  return {
    total_candidates: allCandidates.length,
    with_github: allCandidates.filter((c) => (c.githubUrls as string[]).length > 0).length,
    with_attachments: allCandidates.filter((c) => c.attachmentCount > 0).length,
    manifest_updated_at: updatedAt?.toISOString() ?? null,
    status_counts: statusCounts,
    starred_count: starred,
    reports_count: runs.length,
    analysis_runs_count: runs.length,
    latest_sync: latestSync
      ? {
          id: latestSync.id,
          job_type: latestSync.jobType,
          status: latestSync.status,
          message: latestSync.message,
          started_at: latestSync.startedAt.toISOString(),
          finished_at: latestSync.finishedAt?.toISOString(),
        }
      : null,
    role: (criteria.role as string) ?? 'AI-Assisted Web Developer',
  }
}

export async function listCandidates(
  orgId: string,
  opts: {
    q?: string
    status?: string
    starredOnly?: boolean
    hasGithub?: boolean
    sort?: string
    order?: 'asc' | 'desc'
    page?: number
    perPage?: number
    includeScores?: boolean
  } = {},
): Promise<{ candidates: CandidateListItem[]; total: number; page: number; per_page: number; total_pages: number }> {
  const db = getDb()
  const criteria = await loadCriteria(orgId)
  const notes = await getNotesMap(orgId)
  const rows = await db.query.candidates.findMany({
    where: eq(candidates.organizationId, orgId),
  })

  let items: CandidateListItem[] = []
  for (const row of rows) {
    const note = notes.get(row.slug) ?? { slug: row.slug, status: 'new', starred: false, notes: '', tags: [] }
    if (opts.status && note.status !== opts.status) continue
    if (opts.starredOnly && !note.starred) continue
    const gh = row.githubUrls as string[]
    if (opts.hasGithub === true && !gh.length) continue
    if (opts.hasGithub === false && gh.length) continue

    const searchBlob = [row.name, row.email, row.subject, row.slug].join(' ').toLowerCase()
    if (opts.q && !searchBlob.includes(opts.q.toLowerCase())) continue

    const item: CandidateListItem = {
      slug: row.slug,
      email: row.email,
      name: row.name,
      subject: row.subject,
      received_at: row.receivedAt?.toISOString() ?? null,
      github_urls: gh,
      attachment_count: row.attachmentCount,
      primary_pdf: row.primaryPdf,
      pdf_label: row.pdfLabel,
      note,
    }

    if (opts.includeScores !== false) {
      const files = await db.query.candidateFiles.findMany({
        where: and(
          eq(candidateFiles.organizationId, orgId),
          eq(candidateFiles.candidateSlug, row.slug),
          eq(candidateFiles.kind, 'extracted'),
        ),
      })
      const text = combinedText(
        { emailText: row.emailText, metadata: row.metadata as Record<string, unknown> },
        files.map((f) => f.contentText ?? ''),
      )
      item.score = scoreCandidateText(text, row.links as CandidateListItem['links'] & { github: string[] }, criteria)
    }
    items.push(item)
  }

  const sort = opts.sort ?? 'score'
  const order = opts.order ?? 'desc'
  const reverse = order === 'desc'
  const tierRank: Record<string, number> = { tier_a: 4, tier_b: 3, auto_pass: 2, unknown: 1 }

  const shortlistedFirst = (item: CandidateListItem) => (item.note?.status === 'shortlisted' ? 0 : 1)

  if (sort === 'name') {
    items.sort((a, b) => (a.name || a.slug).localeCompare(b.name || b.slug) * (reverse ? -1 : 1))
  } else if (sort === 'score') {
    items.sort((a, b) => {
      const rank = shortlistedFirst(a) - shortlistedFirst(b)
      if (rank !== 0) return rank
      const sa = a.score?.total_score ?? 0
      const sb = b.score?.total_score ?? 0
      return reverse ? sb - sa : sa - sb
    })
  } else if (sort === 'tier') {
    items.sort(
      (a, b) =>
        ((tierRank[b.score?.experience_tier ?? ''] ?? 0) - (tierRank[a.score?.experience_tier ?? ''] ?? 0)) *
        (reverse ? 1 : -1),
    )
  } else if (sort === 'status') {
    items.sort(
      (a, b) =>
        (a.note?.status ?? 'new').localeCompare(b.note?.status ?? 'new') * (reverse ? -1 : 1),
    )
  } else {
    items.sort((a, b) => {
      const da = a.received_at ?? ''
      const db = b.received_at ?? ''
      return reverse ? db.localeCompare(da) : da.localeCompare(db)
    })
  }

  const perPage = [10, 15, 25, 50].includes(opts.perPage ?? 15) ? (opts.perPage ?? 15) : 15
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const page = Math.min(opts.page ?? 1, totalPages)
  const start = (page - 1) * perPage

  return {
    candidates: items.slice(start, start + perPage),
    total,
    page,
    per_page: perPage,
    total_pages: totalPages,
  }
}

export async function getCandidate(orgId: string, slug: string): Promise<CandidateFull | null> {
  const db = getDb()
  const row = await db.query.candidates.findFirst({
    where: and(eq(candidates.organizationId, orgId), eq(candidates.slug, slug)),
  })
  if (!row) return null

  const noteRow = await db.query.candidateNotes.findFirst({
    where: and(eq(candidateNotes.organizationId, orgId), eq(candidateNotes.slug, slug)),
  })
  const note: CandidateNote = noteRow
    ? {
        slug,
        status: noteRow.status,
        starred: noteRow.starred,
        notes: noteRow.notes,
        tags: noteRow.tags as string[],
        updated_at: noteRow.updatedAt?.toISOString(),
      }
    : { slug, status: 'new', starred: false, notes: '', tags: [] }

  const files = await db.query.candidateFiles.findMany({
    where: and(eq(candidateFiles.organizationId, orgId), eq(candidateFiles.candidateSlug, slug)),
  })

  const attachments = files
    .filter((f) => f.kind === 'attachment')
    .map((f) => ({
      filename: (f.metadata as { filename?: string }).filename ?? f.filename,
      saved_as: f.filename,
      mime_type: f.mimeType ?? 'application/pdf',
      size_bytes: f.sizeBytes ?? undefined,
      exists: true,
    }))

  const extracted = files
    .filter((f) => f.kind === 'extracted')
    .map((f) => {
      const content = f.contentText ?? ''
      return { filename: f.filename, content, chars: content.length }
    })

  const criteria = await loadCriteria(orgId)
  const text = combinedText(
    { emailText: row.emailText, metadata: row.metadata as Record<string, unknown> },
    extracted.map((e) => e.content),
  )
  const links = row.links as CandidateFull['links']

  return {
    slug: row.slug,
    email: row.email,
    name: row.name,
    subject: row.subject,
    received_at: row.receivedAt?.toISOString() ?? null,
    github_urls: row.githubUrls as string[],
    attachment_count: row.attachmentCount,
    primary_pdf: row.primaryPdf,
    pdf_label: row.pdfLabel,
    metadata: row.metadata as Record<string, unknown>,
    links,
    email_text: row.emailText,
    attachments,
    extracted,
    note,
    score: scoreCandidateText(text, links, criteria),
  }
}

export async function upsertCandidateNote(
  orgId: string,
  slug: string,
  patch: Partial<Pick<CandidateNote, 'status' | 'starred' | 'notes' | 'tags'>>,
): Promise<CandidateNote> {
  const db = getDb()
  const existing = await db.query.candidateNotes.findFirst({
    where: and(eq(candidateNotes.organizationId, orgId), eq(candidateNotes.slug, slug)),
  })

  const merged = {
    slug,
    status: patch.status ?? existing?.status ?? 'new',
    starred: patch.starred ?? existing?.starred ?? false,
    notes: patch.notes ?? existing?.notes ?? '',
    tags: patch.tags ?? (existing?.tags as string[]) ?? [],
    updated_at: new Date().toISOString(),
  }

  await db
    .insert(candidateNotes)
    .values({
      organizationId: orgId,
      slug,
      status: merged.status,
      starred: merged.starred,
      notes: merged.notes,
      tags: merged.tags,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [candidateNotes.organizationId, candidateNotes.slug],
      set: {
        status: merged.status,
        starred: merged.starred,
        notes: merged.notes,
        tags: merged.tags,
        updatedAt: new Date(),
      },
    })

  return merged
}

export async function listAnalysisRuns(orgId: string) {
  const db = getDb()
  const rows = await db.query.analysisRuns.findMany({
    where: eq(analysisRuns.organizationId, orgId),
    orderBy: [desc(analysisRuns.id)],
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    filter: r.filterJson as Record<string, unknown>,
    created_at: r.createdAt.toISOString(),
  }))
}

export async function getAnalysisRun(orgId: string, runId: number) {
  const db = getDb()
  const row = await db.query.analysisRuns.findFirst({
    where: and(eq(analysisRuns.organizationId, orgId), eq(analysisRuns.id, runId)),
  })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    filter: row.filterJson as Record<string, unknown>,
    results: row.resultsJson as CandidateListItem[],
    created_at: row.createdAt.toISOString(),
  }
}

export async function deleteAnalysisRun(orgId: string, runId: number) {
  const db = getDb()
  const result = await db
    .delete(analysisRuns)
    .where(and(eq(analysisRuns.organizationId, orgId), eq(analysisRuns.id, runId)))
    .returning({ id: analysisRuns.id })
  return result.length > 0
}

export async function saveAnalysisRun(
  orgId: string,
  name: string,
  filter: Record<string, unknown>,
  results: CandidateListItem[],
) {
  const db = getDb()
  const [row] = await db
    .insert(analysisRuns)
    .values({
      organizationId: orgId,
      name,
      filterJson: filter,
      resultsJson: results,
    })
    .returning({ id: analysisRuns.id })
  return row!.id
}

export async function candidateExists(orgId: string, slug: string) {
  const db = getDb()
  const row = await db.query.candidates.findFirst({
    where: and(eq(candidates.organizationId, orgId), eq(candidates.slug, slug)),
    columns: { id: true },
  })
  return Boolean(row)
}

export async function getAllCandidateSlugs(orgId: string) {
  const db = getDb()
  const rows = await db.query.candidates.findMany({
    where: eq(candidates.organizationId, orgId),
    columns: { slug: true },
  })
  return rows.map((r) => r.slug)
}

export async function slugsWithSentOutbound(orgId: string, slugs: string[]) {
  if (!slugs.length) return []
  const db = getDb()
  const { emailMessages } = await import('#/db/schema')
  const rows = await db
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
  return rows.map((r) => r.slug)
}
