import { and, eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { candidateFiles, candidateNotes, candidates } from '#/db/schema'
import type { CandidateListItem } from '#/lib/types'
import { enrichEntriesWithGithub } from '#/server/github'

export async function enrichRankedResults(orgId: string, ranked: CandidateListItem[]) {
  const db = getDb()
  const notes = await db.query.candidateNotes.findMany({ where: eq(candidateNotes.organizationId, orgId) })
  const notesMap = new Map(notes.map((n) => [n.slug, n]))

  for (const item of ranked) {
    const note = notesMap.get(item.slug)
    item.note = note
      ? {
          slug: item.slug,
          status: note.status,
          starred: note.starred,
          notes: note.notes,
          tags: note.tags as string[],
          updated_at: note.updatedAt.toISOString(),
        }
      : { slug: item.slug, status: 'new', starred: false, notes: '', tags: [] }
  }

  await enrichEntriesWithGithub(ranked as Array<Record<string, unknown>>)

  for (const item of ranked) {
    const files = await db.query.candidateFiles.findMany({
      where: and(
        eq(candidateFiles.organizationId, orgId),
        eq(candidateFiles.candidateSlug, item.slug),
        eq(candidateFiles.kind, 'attachment'),
      ),
    })
    const pdfs = files.filter(
      (f) =>
        f.mimeType === 'application/pdf' ||
        f.filename.toLowerCase().endsWith('.pdf') ||
        ((f.metadata as { filename?: string }).filename ?? '').toLowerCase().endsWith('.pdf'),
    )
    if (pdfs.length) {
      item.primary_pdf = pdfs[0]!.filename
      item.pdf_label = (pdfs[0]!.metadata as { filename?: string }).filename ?? pdfs[0]!.filename
    } else {
      item.primary_pdf = null
      item.pdf_label = null
    }
  }
  return ranked
}

export async function getAllCandidatesForRanking(orgId: string) {
  const db = getDb()
  const rows = await db.query.candidates.findMany({ where: eq(candidates.organizationId, orgId) })
  const result = []
  for (const row of rows) {
    const files = await db.query.candidateFiles.findMany({
      where: and(eq(candidateFiles.organizationId, orgId), eq(candidateFiles.candidateSlug, row.slug)),
    })
    result.push({
      slug: row.slug,
      name: row.name,
      email: row.email,
      received_at: row.receivedAt?.toISOString() ?? null,
      github_urls: row.githubUrls as string[],
      attachment_count: row.attachmentCount,
      email_text: row.emailText,
      links: row.links as { all: string[]; github: string[]; linkedin: string[]; portfolio_and_other: string[] },
      extracted: files.filter((f) => f.kind === 'extracted').map((f) => f.contentText ?? ''),
      metadata: row.metadata as Record<string, unknown>,
    })
  }
  return result
}
