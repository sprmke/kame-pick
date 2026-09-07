/**
 * One-time migration: local data/candidates + data/app.db → Supabase Postgres + Storage
 *
 * Usage:
 *   cp .env.example .env.local  # fill DATABASE_URL, SUPABASE_*, ORGANIZATION_ID
 *   bun run migrate:local
 */
import 'dotenv/config'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { eq } from 'drizzle-orm'
import { getDb } from '../src/db/index.ts'
import { candidateFiles, candidateNotes, candidates, analysisRuns } from '../src/db/schema.ts'
import { createServiceClient } from '../src/lib/supabase/server.ts'

const DATA_DIR = resolve(process.env.LOCAL_DATA_DIR ?? './data')
const CANDIDATES_DIR = join(DATA_DIR, 'candidates')
const DB_PATH = join(DATA_DIR, 'app.db')
const ORG_ID = process.env.ORGANIZATION_ID

if (!ORG_ID) {
  console.error('ORGANIZATION_ID is required — copy your org UUID from Supabase after signup')
  process.exit(1)
}

interface ManifestEntry {
  slug: string
  email?: string
  name?: string
  subject?: string
  received_at?: string
  github_urls?: string[]
  attachment_count?: number
  primary_pdf?: string | null
  pdf_label?: string | null
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

async function uploadAttachment(orgId: string, slug: string, filename: string, bytes: Buffer, mime: string) {
  const supabase = createServiceClient()
  const storagePath = `${orgId}/${slug}/attachments/${filename}`
  const { error } = await supabase.storage.from('candidate-files').upload(storagePath, bytes, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload ${slug}/${filename}: ${error.message}`)
  return storagePath
}

async function migrateCandidates() {
  const manifestPath = join(CANDIDATES_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error('No manifest.json at', manifestPath)
    process.exit(1)
  }

  const manifest = readJson<{ candidates: ManifestEntry[]; updated_at?: string }>(manifestPath)!
  const db = getDb()
  let imported = 0
  let skipped = 0

  for (const entry of manifest.candidates) {
    const slug = entry.slug
    const existing = await db.query.candidates.findFirst({
      where: eq(candidates.slug, slug),
    })
    if (existing && existing.organizationId === ORG_ID) {
      skipped++
      continue
    }

    const meta = readJson<Record<string, unknown>>(join(CANDIDATES_DIR, slug, 'metadata.json')) ?? {}
    const links =
      readJson<{
        all: string[]
        github: string[]
        linkedin: string[]
        portfolio_and_other: string[]
      }>(join(CANDIDATES_DIR, slug, 'links.json')) ??
      ({ all: [], github: [], linkedin: [], portfolio_and_other: [] } as const)

    let emailText = ''
    const emailPath = join(CANDIDATES_DIR, slug, 'combined-email.txt')
    if (existsSync(emailPath)) emailText = readFileSync(emailPath, 'utf-8')

    await db
      .insert(candidates)
      .values({
        organizationId: ORG_ID!,
        slug,
        email: (meta.email as string) ?? entry.email ?? '',
        name: (meta.name as string) ?? entry.name ?? '',
        subject: (meta.subject as string) ?? entry.subject ?? '',
        receivedAt: entry.received_at ? new Date(entry.received_at) : null,
        githubUrls: entry.github_urls ?? links.github ?? [],
        attachmentCount: entry.attachment_count ?? 0,
        primaryPdf: entry.primary_pdf,
        pdfLabel: entry.pdf_label,
        metadata: meta,
        links,
        emailText,
      })
      .onConflictDoNothing()

    const attDir = join(CANDIDATES_DIR, slug, 'attachments')
    if (existsSync(attDir)) {
      for (const file of readdirSync(attDir)) {
        const bytes = readFileSync(join(attDir, file))
        const storagePath = await uploadAttachment(ORG_ID!, slug, file, bytes, 'application/pdf')
        await db.insert(candidateFiles).values({
          organizationId: ORG_ID!,
          candidateSlug: slug,
          kind: 'attachment',
          filename: file,
          storagePath,
          mimeType: 'application/pdf',
          sizeBytes: bytes.length,
          metadata: { filename: file },
        })
      }
    }

    const extDir = join(CANDIDATES_DIR, slug, 'extracted')
    if (existsSync(extDir)) {
      for (const file of readdirSync(extDir)) {
        const content = readFileSync(join(extDir, file), 'utf-8')
        await db.insert(candidateFiles).values({
          organizationId: ORG_ID!,
          candidateSlug: slug,
          kind: 'extracted',
          filename: file,
          contentText: content,
          metadata: {},
        })
      }
    }

    imported++
    if (imported % 10 === 0) console.log(`  … ${imported} candidates`)
  }

  console.log(`Candidates: ${imported} imported, ${skipped} skipped`)
}

function migrateSqlite() {
  if (!existsSync(DB_PATH)) {
    console.log('No app.db — skipping notes/runs')
    return
  }

  const sqlite = new Database(DB_PATH)
  const db = getDb()

  const notes = sqlite.query('SELECT * FROM candidate_notes').all() as Array<{
    slug: string
    status: string
    starred: number
    notes: string
    tags: string
  }>

  let notesCount = 0
  for (const n of notes) {
    db.insert(candidateNotes)
      .values({
        organizationId: ORG_ID!,
        slug: n.slug,
        status: n.status,
        starred: Boolean(n.starred),
        notes: n.notes,
        tags: JSON.parse(n.tags || '[]'),
      })
      .onConflictDoUpdate({
        target: [candidateNotes.organizationId, candidateNotes.slug],
        set: {
          status: n.status,
          starred: Boolean(n.starred),
          notes: n.notes,
          tags: JSON.parse(n.tags || '[]'),
        },
      })
    notesCount++
  }
  console.log(`Notes: ${notesCount} migrated`)

  const runs = sqlite.query('SELECT * FROM analysis_runs').all() as Array<{
    id: number
    name: string
    filter_json: string
    results_json: string
    created_at: string
  }>

  for (const r of runs) {
    db.insert(analysisRuns).values({
      organizationId: ORG_ID!,
      name: r.name,
      filterJson: JSON.parse(r.filter_json),
      resultsJson: JSON.parse(r.results_json),
      createdAt: new Date(r.created_at),
    })
  }
  console.log(`Analysis runs: ${runs.length} migrated`)
}

async function main() {
  console.log('Migrating local data → Supabase')
  console.log('  Org:', ORG_ID)
  console.log('  Data:', DATA_DIR)
  await migrateCandidates()
  migrateSqlite()
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
