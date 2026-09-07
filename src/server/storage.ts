import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { getDb } from '#/db'
import { candidateFiles } from '#/db/schema'
import { createServiceClient } from '#/lib/supabase/server'
import { requireOrgContext } from '#/server/auth'

const BUCKET = 'candidate-files'

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is required')
  if (raw.length === 44 && raw.endsWith('=')) return Buffer.from(raw, 'base64')
  return createHash('sha256').update(raw).digest()
}

export function encryptText(text: string): string {
  const key = getKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key.slice(0, 32), iv)
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `${iv.toString('base64')}:${enc.toString('base64')}`
}

export function decryptText(payload: string): string {
  const key = getKey()
  const [ivB64, dataB64] = payload.split(':')
  const iv = Buffer.from(ivB64!, 'base64')
  const data = Buffer.from(dataB64!, 'base64')
  const decipher = createDecipheriv('aes-256-cbc', key.slice(0, 32), iv)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export async function getAttachmentBytes(orgId: string, slug: string, filename: string) {
  const db = getDb()
  const file = await db.query.candidateFiles.findFirst({
    where: and(
      eq(candidateFiles.organizationId, orgId),
      eq(candidateFiles.candidateSlug, slug),
      eq(candidateFiles.filename, filename),
      eq(candidateFiles.kind, 'attachment'),
    ),
  })
  if (!file?.storagePath) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(file.storagePath)
  if (error || !data) return null
  const bytes = Buffer.from(await data.arrayBuffer())
  return { bytes, mimeType: file.mimeType ?? 'application/pdf', filename }
}

export async function getAttachmentSignedUrl(orgId: string, slug: string, filename: string) {
  const db = getDb()
  const file = await db.query.candidateFiles.findFirst({
    where: and(
      eq(candidateFiles.organizationId, orgId),
      eq(candidateFiles.candidateSlug, slug),
      eq(candidateFiles.filename, filename),
    ),
  })
  if (!file?.storagePath) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file.storagePath, 3600)
  if (error) return null
  return data.signedUrl
}

export async function saveAttachment(
  orgId: string,
  slug: string,
  filename: string,
  bytes: Buffer,
  mimeType: string,
  metadata: Record<string, unknown> = {},
) {
  const storagePath = `${orgId}/${slug}/attachments/${filename}`
  const supabase = createServiceClient()
  await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mimeType, upsert: true })
  const db = getDb()
  await db.insert(candidateFiles).values({
    organizationId: orgId,
    candidateSlug: slug,
    kind: 'attachment',
    filename,
    storagePath,
    mimeType,
    sizeBytes: bytes.length,
    metadata,
  })
}

export function attachmentProxyPath(slug: string, filename: string) {
  return `/pdf-proxy/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`
}
