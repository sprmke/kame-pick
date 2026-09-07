const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi
const GITHUB_PATTERN = /https?:\/\/(?:www\.)?github\.com\/[^\s<>"')\]]+/gi

export function slugifyEmail(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, '-')
    .replace('@', '-at-')
}

export function extractUrls(...texts: string[]) {
  const all = new Set<string>()
  const github = new Set<string>()
  const linkedin = new Set<string>()
  const other = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(URL_PATTERN)) {
      const url = match[0]!.replace(/[.,);]+$/, '')
      all.add(url)
      const lower = url.toLowerCase()
      if (lower.includes('github.com')) github.add(url)
      else if (lower.includes('linkedin.com')) linkedin.add(url)
      else other.add(url)
    }
  }
  return {
    all: [...all].sort(),
    github: [...github].sort(),
    linkedin: [...linkedin].sort(),
    portfolio_and_other: [...other].sort(),
  }
}

function decodePartData(data: string) {
  return Buffer.from(data, 'base64url').toString('utf-8')
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface GmailPart {
  mimeType?: string
  filename?: string
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}

export function parseMessagePayload(payload: GmailPart) {
  const texts: string[] = []
  const htmls: string[] = []
  const attachments: Array<{ filename: string; mime_type: string; attachment_id: string; size: number }> = []

  function walk(part: GmailPart) {
    if (part.parts?.length) {
      for (const child of part.parts) walk(child)
      return
    }
    const mime = part.mimeType ?? ''
    const filename = part.filename ?? ''
    if (filename && part.body?.attachmentId) {
      attachments.push({
        filename,
        mime_type: mime,
        attachment_id: part.body.attachmentId,
        size: part.body.size ?? 0,
      })
      return
    }
    const data = part.body?.data
    if (!data) return
    const decoded = decodePartData(data)
    if (mime === 'text/plain') texts.push(decoded)
    else if (mime === 'text/html') htmls.push(decoded)
  }

  walk(payload)
  let plain = texts.join('\n\n').trim()
  const html = htmls.join('\n\n').trim()
  if (!plain && html) plain = htmlToText(html)
  return { plain, html, attachments }
}

export function safeFilename(name: string) {
  return (name.trim() || 'attachment').replace(/[^\w.\- ]+/g, '_')
}

export function buildGmailQuery(customQuery: string, afterDate?: string) {
  const parts = [customQuery || 'subject:(application OR resume OR cv)'].filter(Boolean)
  if (afterDate) parts.push(`after:${afterDate.replace(/-/g, '/')}`)
  return parts.join(' ')
}
