import type { CandidateLinks, CandidateListItem, ScoreBreakdown } from '#/lib/types'
import { loadCriteria } from '#/server/candidates'
import { scoreCandidateText } from '#/server/scorer'
import { getGithubCacheBulk } from '#/server/workflow'
import { usernameFromUrls } from '#/server/github'

export interface RankFilterConfig {
  filipino_only: boolean
  exclude_auto_pass: boolean
  min_dev_years: number | null
  max_dev_years: number | null
  experience_level: string
  has_github: boolean | null
  min_github_repos: number | null
  tech_any: string[]
  tech_all: string[]
  locations: string[]
  gender: string
  min_age: number | null
  max_age: number | null
  has_honors: boolean | null
  has_ai_tools: boolean | null
  min_score: number | null
  tiers: string[]
  top_n: number
}

export function rankFilterFromDict(data: Record<string, unknown>): RankFilterConfig {
  return {
    filipino_only: data.filipino_only !== false,
    exclude_auto_pass: data.exclude_auto_pass !== false,
    min_dev_years: data.min_dev_years != null ? Number(data.min_dev_years) : null,
    max_dev_years: data.max_dev_years != null ? Number(data.max_dev_years) : 2,
    experience_level: String(data.experience_level ?? 'any'),
    has_github: data.has_github == null ? null : Boolean(data.has_github),
    min_github_repos: data.min_github_repos != null ? Number(data.min_github_repos) : null,
    tech_any: (data.tech_any as string[]) ?? [],
    tech_all: (data.tech_all as string[]) ?? [],
    locations: (data.locations as string[]) ?? [],
    gender: String(data.gender ?? 'any'),
    min_age: data.min_age != null ? Number(data.min_age) : null,
    max_age: data.max_age != null ? Number(data.max_age) : null,
    has_honors: data.has_honors == null ? null : Boolean(data.has_honors),
    has_ai_tools: data.has_ai_tools == null ? null : Boolean(data.has_ai_tools),
    min_score: data.min_score != null ? Number(data.min_score) : null,
    tiers: (data.tiers as string[]) ?? [],
    top_n: Number(data.top_n ?? 10),
  }
}

function estimateGender(text: string): string {
  const t = text.toLowerCase()
  const female = [/\bshe\/her\b/, /\bher pronouns\b/, /\bfemale\b/, /\bmiss\b/, /\bmrs\.?\b/, /\bms\.?\b/]
  const male = [/\bhe\/him\b/, /\bhis pronouns\b/, /\bmale\b/, /\bmr\.?\b/]
  const fScore = female.filter((p) => p.test(t)).length
  const mScore = male.filter((p) => p.test(t)).length
  if (fScore > mScore && fScore > 0) return 'female'
  if (mScore > fScore && mScore > 0) return 'male'
  return 'unknown'
}

function estimateAge(text: string, referenceYear = 2026): number | null {
  const t = text.toLowerCase()
  let m = t.match(/\bage\s*[:\-]?\s*(\d{2})\b/)
  if (m) {
    const age = parseInt(m[1]!, 10)
    if (age >= 16 && age <= 70) return age
  }
  m = t.match(/\b(\d{2})\s*years?\s*old\b/)
  if (m) {
    const age = parseInt(m[1]!, 10)
    if (age >= 16 && age <= 70) return age
  }
  m = t.match(/\bborn\s*[:\-]?\s*(\d{4})\b/)
  if (m) {
    const year = parseInt(m[1]!, 10)
    if (year >= 1950 && year <= referenceYear) return referenceYear - year
  }
  m = t.match(/\bbatch\s*(\d{4})\b/)
  if (m) {
    const year = parseInt(m[1]!, 10)
    if (year >= 2015 && year <= referenceYear + 1) return Math.max(0, referenceYear - year + 22)
  }
  return null
}

function locationHits(text: string, criteria: Record<string, unknown>): string[] {
  const preferred = ((criteria.location as { preferred_regions?: string[] })?.preferred_regions) ?? []
  const keywords = [
    ...preferred,
    'philippines',
    'pampanga',
    'region iii',
    'central luzon',
    'metro manila',
    'ncr',
    'cebu',
    'davao',
    'angeles',
    'clark',
  ]
  const lower = text.toLowerCase()
  return [...new Set(keywords.filter((kw) => lower.includes(kw.toLowerCase())))]
}

export interface CandidateProfile {
  slug: string
  name: string
  email: string
  received_at: string | null
  github_urls: string[]
  attachment_count: number
  score: ScoreBreakdown
  text: string
  estimated_gender: string
  estimated_age: number | null
  github_repo_count: number | null
  location_hits: string[]
  links: CandidateLinks
}

export async function buildCandidateProfile(
  entry: {
    slug: string
    name: string
    email: string
    received_at: string | null
    github_urls: string[]
    attachment_count: number
    email_text: string
    links: CandidateLinks
    extracted: string[]
    metadata: Record<string, unknown>
  },
  criteria: Record<string, unknown>,
  ghCache: Map<string, { public_repos: number | null; profile: Record<string, unknown> | null; error: string | null }>,
): Promise<CandidateProfile> {
  const text = [entry.email_text, ...entry.extracted, (entry.metadata.resume_text as string) ?? '']
    .filter(Boolean)
    .join('\n\n')
  const score = scoreCandidateText(text, entry.links, criteria)
  const user = usernameFromUrls([...entry.links.github, ...entry.github_urls])
  let repoCount: number | null = null
  if (user) {
    const row = ghCache.get(user.toLowerCase())
    if (row && !row.error) repoCount = row.public_repos
    else if (row?.profile) repoCount = (row.profile.public_repos as number) ?? null
  }
  return {
    slug: entry.slug,
    name: entry.name || entry.slug,
    email: entry.email,
    received_at: entry.received_at,
    github_urls: entry.github_urls.length ? entry.github_urls : entry.links.github,
    attachment_count: entry.attachment_count,
    score,
    text,
    estimated_gender: estimateGender(text),
    estimated_age: estimateAge(text),
    github_repo_count: repoCount,
    location_hits: locationHits(text, criteria),
    links: entry.links,
  }
}

export function passesFilters(
  profile: CandidateProfile,
  cfg: RankFilterConfig,
): [boolean, string | null] {
  const sc = profile.score
  if (cfg.filipino_only && !sc.filipino_verified) return [false, 'Not Filipino-verified']
  if (cfg.exclude_auto_pass && sc.auto_pass) return [false, sc.auto_pass_reason ?? 'Auto-pass']
  if (cfg.tiers.length && !cfg.tiers.includes(sc.experience_tier)) return [false, `Tier ${sc.experience_tier}`]
  if (cfg.min_dev_years != null) {
    const years = sc.experience_years ?? 0
    if (years < cfg.min_dev_years) return [false, 'Below min experience']
  }
  if (cfg.max_dev_years != null && sc.experience_years != null && sc.experience_years >= cfg.max_dev_years) {
    return [false, 'Above max experience']
  }
  if (cfg.experience_level === 'fresh_grad') {
    if (
      !['tier_b', 'unknown'].includes(sc.experience_tier) &&
      (sc.experience_years ?? 0) > 0.5 &&
      !/fresh\s+grad|new\s+grad|recent\s+grad/i.test(profile.text)
    ) {
      return [false, 'Not fresh grad']
    }
  } else if (cfg.experience_level === 'has_work_exp') {
    if (
      (sc.experience_years ?? 0) < 0.25 &&
      sc.experience_tier === 'tier_b' &&
      !/developer|engineer|internship/i.test(profile.text)
    ) {
      return [false, 'No work experience']
    }
  } else if (cfg.experience_level === 'intern_only') {
    if (!/intern(?:ship)?|ojt|on[\s-]?the[\s-]?job/i.test(profile.text)) return [false, 'No intern/OJT signal']
  }
  if (cfg.has_github === true && !profile.github_urls.length) return [false, 'No GitHub']
  if (cfg.has_github === false && profile.github_urls.length) return [false, 'Has GitHub']
  if (cfg.min_github_repos != null) {
    if (profile.github_repo_count == null || profile.github_repo_count < cfg.min_github_repos) {
      return [false, 'GitHub repos below minimum']
    }
  }
  const lower = profile.text.toLowerCase()
  if (cfg.tech_any.length && !cfg.tech_any.some((t) => lower.includes(t.toLowerCase()))) {
    return [false, 'Tech stack (any) not matched']
  }
  if (cfg.tech_all.length) {
    const missing = cfg.tech_all.filter((t) => !lower.includes(t.toLowerCase()))
    if (missing.length) return [false, `Missing tech: ${missing.slice(0, 3).join(', ')}`]
  }
  if (cfg.locations.length && !cfg.locations.some((loc) => lower.includes(loc.toLowerCase()))) {
    return [false, 'Location not matched']
  }
  if (cfg.gender === 'female' && profile.estimated_gender !== 'female') return [false, 'Gender filter (est.)']
  if (cfg.gender === 'male' && profile.estimated_gender !== 'male') return [false, 'Gender filter (est.)']
  if (cfg.min_age != null && (profile.estimated_age == null || profile.estimated_age < cfg.min_age)) {
    return [false, 'Below min age (est.)']
  }
  if (cfg.max_age != null && (profile.estimated_age == null || profile.estimated_age > cfg.max_age)) {
    return [false, 'Above max age (est.)']
  }
  if (cfg.has_honors === true && !sc.honors_found.length) return [false, 'No honors']
  if (cfg.has_honors === false && sc.honors_found.length) return [false, 'Has honors']
  if (cfg.has_ai_tools === true && !sc.ai_tools_found.length) return [false, 'No AI tools']
  if (cfg.has_ai_tools === false && sc.ai_tools_found.length) return [false, 'Has AI tools']
  if (cfg.min_score != null && sc.total_score < cfg.min_score) return [false, 'Below min score']
  return [true, null]
}

function profileToResult(profile: CandidateProfile): CandidateListItem {
  return {
    slug: profile.slug,
    name: profile.name,
    email: profile.email,
    received_at: profile.received_at,
    github_urls: profile.github_urls,
    attachment_count: profile.attachment_count,
    score: profile.score,
    github_repo_count: profile.github_repo_count,
    location_hits: profile.location_hits,
  } as CandidateListItem & { location_hits?: string[]; estimated_gender?: string; estimated_age?: number | null }
}

export async function rankWithFilters(
  orgId: string,
  cfg: RankFilterConfig,
  allEntries: Array<Awaited<ReturnType<typeof buildCandidateProfile>> extends never ? never : Parameters<typeof buildCandidateProfile>[0]>,
): Promise<[CandidateListItem[], Record<string, unknown>]> {
  const criteria = await loadCriteria(orgId)
  const usernames = allEntries
    .map((e) => usernameFromUrls([...e.links.github, ...e.github_urls]))
    .filter(Boolean) as string[]
  const ghCache = await getGithubCacheBulk(usernames)

  const matched: CandidateProfile[] = []
  const exclusionCounts: Record<string, number> = {}

  for (const entry of allEntries) {
    const profile = await buildCandidateProfile(entry, criteria, ghCache)
    const [ok, reason] = passesFilters(profile, cfg)
    if (ok) matched.push(profile)
    else if (reason) exclusionCounts[reason] = (exclusionCounts[reason] ?? 0) + 1
  }

  matched.sort((a, b) => b.score.total_score - a.score.total_score)
  const top = cfg.top_n ? matched.slice(0, cfg.top_n) : matched

  return [
    top.map(profileToResult),
    {
      total_synced: allEntries.length,
      matched_pool: matched.length,
      returned: top.length,
      exclusion_counts: exclusionCounts,
    },
  ]
}

export async function getFilterOptions(orgId: string) {
  const criteria = await loadCriteria(orgId)
  const preferred = ((criteria.tech_stack as { preferred?: string[] })?.preferred) ?? []
  const locations = ((criteria.location as { preferred_regions?: string[] })?.preferred_regions) ?? []
  return {
    tech_options: preferred,
    location_presets: [...locations, 'Philippines', 'Metro Manila', 'NCR', 'Cebu', 'Davao'],
    experience_levels: [
      { id: 'any', label: 'Any experience level' },
      { id: 'fresh_grad', label: 'Fresh grad / no paid dev' },
      { id: 'has_work_exp', label: 'Has dev work experience' },
      { id: 'intern_only', label: 'Intern / OJT only' },
    ],
    tier_options: [
      { id: 'tier_a', label: 'Tier A (junior ≤2yr)' },
      { id: 'tier_b', label: 'Tier B (fresh grad)' },
      { id: 'unknown', label: 'Unknown tier' },
    ],
    gender_note:
      'Gender is estimated from CV/email text (pronouns, labels) — not guaranteed accurate.',
  }
}
