export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export interface ScoreBreakdown {
  experience_tier: string
  experience_years: number | null
  filipino_verified: boolean
  filipino_signals: string[]
  auto_pass: boolean
  auto_pass_reason: string | null
  tech_stack_score: number
  tech_required_met: string[]
  tech_preferred_met: string[]
  git_score: number
  git_evidence: string
  honors_score: number
  honors_found: string[]
  ai_tools_score: number
  ai_tools_found: string[]
  location_score: number
  location_signals: string[]
  red_flags: string[]
  total_score: number
}

export interface CandidateNote {
  slug: string
  status: string
  starred: boolean
  notes: string
  tags: string[]
  updated_at?: string
}

export interface CandidateListItem {
  slug: string
  email: string
  name: string
  subject: string
  received_at: string | null
  github_urls: string[]
  github_username?: string | null
  github_repo_count?: number | null
  github_fetch_error?: string | null
  attachment_count: number
  note?: CandidateNote
  score?: ScoreBreakdown
  primary_pdf?: string | null
  pdf_label?: string | null
}

export interface SyncJob {
  id: number
  job_type: string
  status: string
  message: string
  started_at: string
  finished_at?: string | null
}

export interface DashboardData {
  total_candidates: number
  with_github: number
  with_attachments: number
  manifest_updated_at: string | null
  status_counts: { [status: string]: number }
  starred_count: number
  reports_count: number
  analysis_runs_count: number
  latest_sync: SyncJob | null
  role: string
}

export interface CandidateLinks {
  all: string[]
  github: string[]
  linkedin: string[]
  portfolio_and_other: string[]
}

export interface CandidateFull extends CandidateListItem {
  metadata: JsonObject
  links: CandidateLinks
  email_text: string
  attachments: Array<{
    filename: string
    saved_as: string
    mime_type: string
    size_bytes?: number
    exists?: boolean
  }>
  extracted: Array<{ filename: string; content: string; chars: number }>
}

export interface AnalysisRun {
  id: number
  name: string
  filter: JsonObject
  created_at: string
  results?: CandidateListItem[]
}

export interface EmailMessage {
  id: number | string
  slug: string
  analysis_run_id: number | null
  gmail_message_id: string | null
  gmail_thread_id: string | null
  direction: string
  from_email: string
  to_email: string
  subject: string
  body_text: string
  sent_at: string
  created_at?: string
  status: string
  error?: string | null
  source?: string
}

export interface EmailThread {
  slug: string
  analysis_run_id: number | null
  candidate_email: string
  default_subject: string
  gmail_thread_id: string | null
  has_outbound: boolean
  messages: EmailMessage[]
}

export interface GitHubRepoSummary {
  name: string
  url: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  is_fork: boolean
  pushed_at: string | null
  days_since_push: number | null
  is_active: boolean
}

export interface GitHubInsights {
  username: string
  profile_url?: string
  avatar_url?: string
  bio?: string
  public_repos?: number
  followers?: number
  following?: number
  account_created_at?: string | null
  owned_repo_count?: number
  fork_repos_count?: number
  active_repo_count?: number
  inactive_repo_count?: number
  is_active?: boolean
  activity_label?: string
  last_pushed_at?: string | null
  days_since_last_push?: number | null
  total_stars?: number
  top_repos?: GitHubRepoSummary[]
  recent_active_repos?: GitHubRepoSummary[]
  fetched_at?: string
  from_cache?: boolean
  error?: string
}

export interface OrgContext {
  userId: string
  email: string
  organizationId: string
  orgRole: string
}

export interface JobCriteriaData {
  raw: string
  parsed: JsonObject | null
}

export interface RankPreviewStats {
  total_synced: number
  matched_pool: number
  returned: number
  exclusion_counts: { [reason: string]: number }
}

export interface GithubApiStatus {
  token_configured: boolean
  ok: boolean
  error?: string
  limit?: number
  remaining?: number
  reset_at?: number
  authenticated?: boolean
}

export interface BatchEmailResult {
  slug: string
  ok: boolean
  skipped?: boolean
  error?: string
  message?: EmailMessage
  status_updated?: boolean
}
