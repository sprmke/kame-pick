export interface RankFiltersState {
  report_name: string
  top_n: number
  filipino_only: boolean
  exclude_auto_pass: boolean
  min_dev_years: number | ''
  max_dev_years: number | ''
  experience_level: string
  has_github: '' | 'yes' | 'no'
  min_github_repos: number | ''
  tech_any: string[]
  tech_all: string[]
  locations: string[]
  gender: string
  min_age: number | ''
  max_age: number | ''
  has_honors: '' | 'yes' | 'no'
  has_ai_tools: '' | 'yes' | 'no'
  min_score: number | ''
  tiers: string[]
}

export const defaultRankFilters = (): RankFiltersState => ({
  report_name: 'web-ranking',
  top_n: 10,
  filipino_only: true,
  exclude_auto_pass: true,
  min_dev_years: '',
  max_dev_years: 2,
  experience_level: 'any',
  has_github: '',
  min_github_repos: '',
  tech_any: [],
  tech_all: [],
  locations: [],
  gender: 'any',
  min_age: '',
  max_age: '',
  has_honors: '',
  has_ai_tools: '',
  min_score: '',
  tiers: [],
})

function triFromPayload(v: unknown): '' | 'yes' | 'no' {
  if (v === true) return 'yes'
  if (v === false) return 'no'
  return ''
}

function numFromPayload(v: unknown): number | '' {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

export function fromRankPayload(raw: Record<string, unknown>): RankFiltersState {
  const def = defaultRankFilters()
  return {
    report_name: def.report_name,
    top_n: Number(raw.top_n ?? def.top_n),
    filipino_only: raw.filipino_only !== false,
    exclude_auto_pass: raw.exclude_auto_pass !== false,
    min_dev_years: numFromPayload(raw.min_dev_years),
    max_dev_years: numFromPayload(raw.max_dev_years),
    experience_level: String(raw.experience_level ?? def.experience_level),
    has_github: triFromPayload(raw.has_github),
    min_github_repos: numFromPayload(raw.min_github_repos),
    tech_any: Array.isArray(raw.tech_any) ? raw.tech_any.map(String) : [],
    tech_all: Array.isArray(raw.tech_all) ? raw.tech_all.map(String) : [],
    locations: Array.isArray(raw.locations) ? raw.locations.map(String) : [],
    gender: String(raw.gender ?? def.gender),
    min_age: numFromPayload(raw.min_age),
    max_age: numFromPayload(raw.max_age),
    has_honors: triFromPayload(raw.has_honors),
    has_ai_tools: triFromPayload(raw.has_ai_tools),
    min_score: numFromPayload(raw.min_score),
    tiers: Array.isArray(raw.tiers) ? raw.tiers.map(String) : [],
  }
}

export function toRankPayload(f: RankFiltersState) {
  return {
    report_name: f.report_name,
    top_n: f.top_n,
    filipino_only: f.filipino_only,
    exclude_auto_pass: f.exclude_auto_pass,
    min_dev_years: f.min_dev_years === '' ? null : Number(f.min_dev_years),
    max_dev_years: f.max_dev_years === '' ? null : Number(f.max_dev_years),
    experience_level: f.experience_level,
    has_github: f.has_github === '' ? null : f.has_github === 'yes',
    min_github_repos: f.min_github_repos === '' ? null : Number(f.min_github_repos),
    tech_any: f.tech_any,
    tech_all: f.tech_all,
    locations: f.locations,
    gender: f.gender,
    min_age: f.min_age === '' ? null : Number(f.min_age),
    max_age: f.max_age === '' ? null : Number(f.max_age),
    has_honors: f.has_honors === '' ? null : f.has_honors === 'yes',
    has_ai_tools: f.has_ai_tools === '' ? null : f.has_ai_tools === 'yes',
    min_score: f.min_score === '' ? null : Number(f.min_score),
    tiers: f.tiers,
    save_run: false,
  }
}
