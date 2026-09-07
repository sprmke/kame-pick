import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { CandidateLinks, ScoreBreakdown } from '#/lib/types'

export type Criteria = Record<string, unknown>

const DEFAULT_CRITERIA_PATH = join(process.cwd(), 'config/job-criteria.yaml')

export function loadDefaultCriteria(): Criteria {
  return parseYaml(readFileSync(DEFAULT_CRITERIA_PATH, 'utf-8')) as Criteria
}

function containsAny(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()))
}

function estimateExperienceYears(text: string): number | null {
  const patterns: Array<[RegExp, number]> = [
    [/(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?(?:experience|exp)/gi, 1],
    [/(\d+(?:\.\d+)?)\s*\+?\s*yrs?\s+(?:of\s+)?(?:experience|exp)/gi, 1],
    [/(\d+)\s*\+?\s*years?\s+(?:as|in)\s+(?:a\s+)?(?:web|software|full[\s-]?stack|frontend|backend|developer)/gi, 1],
    [/(\d+)\s*\+?\s*years?\s+working/gi, 1],
    [/(\d+)\s*months?\s+(?:of\s+)?(?:experience|internship|intern)/gi, 1 / 12],
  ]
  const years: number[] = []
  for (const [pattern, mult] of patterns) {
    for (const m of text.matchAll(pattern)) {
      const n = parseFloat(m[1]!)
      if (!Number.isNaN(n)) years.push(n * mult)
    }
  }
  if (/fresh\s+grad|new\s+grad|recent\s+grad|no\s+professional\s+experience|0\s+years?/i.test(text)) {
    years.push(0)
  }
  if (/intern(?:ship)?|ojt|on[\s-]?the[\s-]?job\s+training/i.test(text) && years.length === 0) {
    years.push(0.25)
  }
  return years.length ? Math.max(...years) : null
}

function checkFilipino(text: string, criteria: Criteria): [boolean, string[]] {
  const signalsCfg = (criteria.filipino_signals ?? {}) as Record<string, string[]>
  const signals: string[] = []
  const phPatterns = [
    /philippines/i,
    /\bph\b/i,
    /pampanga/i,
    /region\s*iii/i,
    /central\s+luzon/i,
    /metro\s+manila/i,
    /\bncr\b/i,
    /\+63/,
    /\b09\d{9}\b/,
    /angeles\s+city/i,
    /san\s+fernando/i,
    /clark/i,
    /cebu/i,
    /davao/i,
  ]
  for (const p of phPatterns) {
    if (p.test(text)) signals.push(p.source.replace(/\\b/g, '').replace(/\\s\+/g, ' '))
  }
  for (const school of signalsCfg.schools ?? []) {
    if (text.toLowerCase().includes(school.toLowerCase())) signals.push(`school:${school}`)
  }
  for (const loc of signalsCfg.location_keywords ?? []) {
    if (text.toLowerCase().includes(loc.toLowerCase())) signals.push(`location:${loc}`)
  }
  return [signals.length >= 2, signals.slice(0, 8)]
}

function scoreTech(text: string, criteria: Criteria): [number, string[], string[]] {
  const requiredMap = {
    programming: ['programming', 'software development', 'web development', 'developer'],
    git: ['git', 'github', 'gitlab', 'bitbucket', 'version control'],
    editor: (criteria.editor_signals as string[]) ?? ['vscode', 'vs code', 'cursor'],
    ai_tools: ((criteria.ai_tools_signals as string[]) ?? []).slice(0, 12).map((s) => s.toLowerCase()),
  }
  const preferred = ((criteria.tech_stack as { preferred?: string[] })?.preferred ?? []).flatMap((item) =>
    item.toLowerCase().split(' '),
  )

  const requiredMet: string[] = []
  if (containsAny(text, requiredMap.programming).length) requiredMet.push('programming/web basics')
  if (containsAny(text, requiredMap.git).length) requiredMet.push('git fundamentals')
  if (containsAny(text, requiredMap.editor.map((e) => e.toLowerCase())).length)
    requiredMet.push('VS Code / Cursor')
  const aiFound = containsAny(text, requiredMap.ai_tools)
  if (aiFound.length) requiredMet.push('AI coding tools')
  if (text.length > 400) requiredMet.push('written communication (CV present)')

  const preferredMet = containsAny(text, preferred.filter((p) => p.length > 2))
  const raw = requiredMet.length * 8 + preferredMet.length * 3
  return [Math.min(30, raw), requiredMet, preferredMet]
}

function scoreGit(text: string, links: CandidateLinks): [number, string] {
  const github = links.github ?? []
  const gitMentions = /\bgit\b|github|gitlab/i.test(text)
  if (github.length) return [15, `GitHub: ${github[0]}`]
  if (gitMentions) return [5, 'Git mentioned on CV/email']
  if ((links.portfolio_and_other ?? []).length) return [8, 'Portfolio link (no GitHub)']
  return [0, 'No Git/GitHub evidence']
}

function scoreHonors(text: string, criteria: Criteria): [number, string[]] {
  const keywords = (criteria.honors_keywords as string[]) ?? []
  const found = containsAny(text, keywords.map((k) => k.toLowerCase()))
  if (!found.length) return [0, []]
  return [Math.min(15, 10 + found.length * 2), found]
}

function scoreAi(text: string, criteria: Criteria): [number, string[]] {
  const signals = ((criteria.ai_tools_signals as string[]) ?? []).map((s) => s.toLowerCase())
  let found = containsAny(text, signals)
  const extra = containsAny(text, ['ai-assisted', 'ai assisted', 'vibe coding', 'built with cursor'])
  found = [...new Set([...found, ...extra])]
  if (!found.length) return [0, []]
  return [Math.min(12, 4 + found.length * 2), found]
}

function scoreLocation(text: string, criteria: Criteria): [number, string[]] {
  const preferred = ((criteria.location as { preferred_regions?: string[] })?.preferred_regions ?? []).map((r) =>
    r.toLowerCase(),
  )
  const found = containsAny(text, preferred)
  if (found.length) return [3, found]
  if (/philippines|pampanga/i.test(text)) return [1, ['Philippines']]
  return [0, []]
}

export function scoreCandidateText(
  text: string,
  links: CandidateLinks,
  criteria: Criteria = loadDefaultCriteria(),
): ScoreBreakdown {
  const weights = ((criteria.ranking as { weights?: Record<string, number> })?.weights ?? {}) as Record<
    string,
    number
  >
  const breakdown: ScoreBreakdown = {
    experience_tier: 'unknown',
    experience_years: null,
    filipino_verified: false,
    filipino_signals: [],
    auto_pass: false,
    auto_pass_reason: null,
    tech_stack_score: 0,
    tech_required_met: [],
    tech_preferred_met: [],
    git_score: 0,
    git_evidence: '',
    honors_score: 0,
    honors_found: [],
    ai_tools_score: 0,
    ai_tools_found: [],
    location_score: 0,
    location_signals: [],
    red_flags: [],
    total_score: 0,
  }

  const [filipinoOk, filSignals] = checkFilipino(text, criteria)
  breakdown.filipino_verified = filipinoOk
  breakdown.filipino_signals = filSignals

  const years = estimateExperienceYears(text)
  breakdown.experience_years = years

  const autoPassMin =
    ((criteria.experience_tiers as { auto_pass?: { min_years?: number } })?.auto_pass?.min_years) ?? 2

  if (years !== null && years > autoPassMin) {
    breakdown.auto_pass = true
    breakdown.auto_pass_reason = `>${autoPassMin} years experience detected (${years.toFixed(1)}y)`
    breakdown.experience_tier = 'auto_pass'
  } else if (/senior|lead developer|principal engineer/i.test(text)) {
    breakdown.auto_pass = true
    breakdown.auto_pass_reason = 'Senior/lead title detected'
    breakdown.experience_tier = 'auto_pass'
  } else if (years !== null && years > 0 && years <= 2) {
    breakdown.experience_tier = 'tier_a'
  } else if (years === 0 || /fresh\s+grad|new\s+grad|student|ojt|intern/i.test(text)) {
    breakdown.experience_tier = 'tier_b'
  }

  const [techScore, reqMet, prefMet] = scoreTech(text, criteria)
  breakdown.tech_stack_score = techScore
  breakdown.tech_required_met = reqMet
  breakdown.tech_preferred_met = prefMet

  const [gitScore, gitEv] = scoreGit(text, links)
  breakdown.git_score = gitScore
  breakdown.git_evidence = gitEv

  const [honorsScore, honors] = scoreHonors(text, criteria)
  breakdown.honors_score = honorsScore
  breakdown.honors_found = honors

  const [aiScore, aiFound] = scoreAi(text, criteria)
  breakdown.ai_tools_score = aiScore
  breakdown.ai_tools_found = aiFound

  const [locScore, locSig] = scoreLocation(text, criteria)
  breakdown.location_score = locScore
  breakdown.location_signals = locSig

  if (!filipinoOk) breakdown.red_flags.push('Filipino/PH location unverified (<2 signals)')
  if (gitScore === 0) breakdown.red_flags.push('No Git/GitHub evidence')
  if (!reqMet.length) breakdown.red_flags.push('Missing required skill signals')

  const expWeight = weights.experience_tier ?? 20
  const tierMultMap: Record<string, number> = { tier_a: 1, tier_b: 0.85, unknown: 0.5, auto_pass: 0 }
  const tierMult = tierMultMap[breakdown.experience_tier] ?? 0.5
  const expPts = Math.floor(expWeight * tierMult)

  const total = Math.min(
    100,
    expPts +
      Math.floor((breakdown.tech_stack_score * (weights.tech_stack_match ?? 30)) / 30) +
      Math.floor((breakdown.git_score * (weights.git_evidence ?? 15)) / 15) +
      Math.floor((breakdown.honors_score * (weights.education_honors ?? 15)) / 15) +
      Math.floor((breakdown.ai_tools_score * (weights.ai_tool_usage ?? 12)) / 12) +
      breakdown.location_score,
  )
  breakdown.total_score = total
  return breakdown
}
