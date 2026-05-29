const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface Dashboard {
  total_candidates: number;
  with_github: number;
  with_attachments: number;
  manifest_updated_at: string | null;
  status_counts: Record<string, number>;
  starred_count: number;
  reports_count: number;
  analysis_runs_count: number;
  latest_sync: SyncJob | null;
  role: string;
}

export interface SyncJob {
  id: number;
  job_type: string;
  status: string;
  message: string;
  started_at: string;
  finished_at?: string;
}

export interface ScoreBreakdown {
  experience_tier: string;
  experience_years: number | null;
  filipino_verified: boolean;
  filipino_signals: string[];
  auto_pass: boolean;
  auto_pass_reason: string | null;
  tech_stack_score: number;
  tech_required_met: string[];
  tech_preferred_met: string[];
  git_score: number;
  git_evidence: string;
  honors_score: number;
  honors_found: string[];
  ai_tools_score: number;
  ai_tools_found: string[];
  location_score: number;
  location_signals: string[];
  red_flags: string[];
  total_score: number;
}

export interface CandidateNote {
  slug: string;
  status: string;
  starred: boolean;
  notes: string;
  tags: string[];
  updated_at?: string;
}

export interface CandidateListItem {
  slug: string;
  email: string;
  name: string;
  subject: string;
  received_at: string;
  github_urls: string[];
  github_username?: string | null;
  github_repo_count?: number | null;
  github_fetch_error?: string | null;
  attachment_count: number;
  note?: CandidateNote;
  score?: ScoreBreakdown;
  primary_pdf?: string | null;
  pdf_label?: string | null;
}

export interface GitHubRepoSummary {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  is_fork: boolean;
  pushed_at: string | null;
  days_since_push: number | null;
  is_active: boolean;
}

export interface GitHubInsights {
  username: string;
  profile_url?: string;
  avatar_url?: string;
  bio?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
  account_created_at?: string;
  owned_repo_count?: number;
  fork_repos_count?: number;
  active_repo_count?: number;
  inactive_repo_count?: number;
  is_active?: boolean;
  activity_label?: string;
  last_pushed_at?: string | null;
  days_since_last_push?: number | null;
  total_stars?: number;
  top_repos?: GitHubRepoSummary[];
  recent_active_repos?: GitHubRepoSummary[];
  fetched_at?: string;
  from_cache?: boolean;
  error?: string;
}

export interface RankingRun {
  id: number;
  name: string;
  filter: Record<string, unknown>;
  created_at: string;
  results: CandidateListItem[];
}

export interface EmailMessage {
  id: number | string;
  slug: string;
  analysis_run_id: number | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  direction: "inbound" | "outbound";
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  sent_at: string;
  created_at: string | null;
  status: string;
  error: string | null;
  source?: string;
}

export interface EmailThread {
  slug: string;
  analysis_run_id: number | null;
  candidate_email: string;
  default_subject: string;
  gmail_thread_id: string | null;
  has_outbound?: boolean;
  messages: EmailMessage[];
}

export interface CandidateDetail extends CandidateListItem {
  metadata: Record<string, unknown>;
  links: {
    all: string[];
    github: string[];
    linkedin: string[];
    portfolio_and_other: string[];
  };
  email_text: string;
  extracted: { filename: string; chars: number; preview: string; content: string }[];
  attachments: {
    filename: string;
    saved_as: string;
    mime_type: string;
    size: number;
    exists: boolean;
  }[];
  score: ScoreBreakdown;
}

export const api = {
  dashboard: () => request<Dashboard>("/dashboard"),
  candidates: (params?: Record<string, string | number | boolean | undefined>) => {
    const qs = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") qs.set(k, String(v));
      });
    }
    const q = qs.toString();
    return request<{
      candidates: CandidateListItem[];
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    }>(`/candidates${q ? `?${q}` : ""}`);
  },
  candidate: (slug: string) => request<CandidateDetail>(`/candidates/${slug}`),
  githubInsights: (slug: string, refresh = false) =>
    request<GitHubInsights>(`/candidates/${slug}/github-insights?refresh=${refresh}`),
  updateNote: (slug: string, body: Partial<CandidateNote>) =>
    request<CandidateNote>(`/candidates/${slug}/note`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  filterOptions: () =>
    request<{
      tech_options: string[];
      location_presets: string[];
      experience_levels: { id: string; label: string }[];
      tier_options: { id: string; label: string }[];
      gender_note: string;
    }>("/analyze/filter-options"),
  previewRank: (body: Record<string, unknown>) =>
    request<{
      total_synced: number;
      matched_pool: number;
      returned: number;
      exclusion_counts?: Record<string, number>;
    }>("/analyze/preview", { method: "POST", body: JSON.stringify(body) }),
  rank: (body: Record<string, unknown>) =>
    request<{
      ranked: CandidateListItem[];
      count: number;
      filters: Record<string, unknown>;
      stats: {
        total_synced: number;
        matched_pool: number;
        returned: number;
      };
      run_id: number | null;
    }>("/analyze/rank", { method: "POST", body: JSON.stringify(body) }),
  analysisRuns: () =>
    request<{ runs: { id: number; name: string; filter: Record<string, unknown>; created_at: string }[] }>(
      "/analyze/runs",
    ),
  analysisRun: (id: number) => request<RankingRun>(`/analyze/runs/${id}`),
  reports: () =>
    request<{ reports: { id: number; name: string; filter: Record<string, unknown>; created_at: string }[] }>(
      "/reports",
    ),
  report: (id: number) => request<RankingRun>(`/reports/${id}`),
  deleteReport: (id: number) =>
    request<{ status: string }>(`/reports/${id}`, { method: "DELETE" }),
  jobCriteria: () =>
    request<{ path: string; parsed: Record<string, unknown>; raw: string }>("/settings/job-criteria"),
  saveJobCriteria: (content: string) =>
    request<{ status: string }>("/settings/job-criteria", {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  syncFetch: (onlyNew = true, force = false) =>
    request<{ status: string }>("/sync/fetch", {
      method: "POST",
      body: JSON.stringify({ only_new: onlyNew, force }),
    }),
  syncExtract: () => request<{ status: string }>("/sync/extract", { method: "POST" }),
  syncFull: (onlyNew = true) =>
    request<{ status: string }>("/sync/full", {
      method: "POST",
      body: JSON.stringify({ only_new: onlyNew }),
    }),
  syncStatus: () =>
    request<{
      fetch: SyncJob | null;
      extract: SyncJob | null;
      full: SyncJob | null;
      candidates_dir_exists: boolean;
    }>("/sync/status"),
  refreshGithubStats: (opts?: { force?: boolean; background?: boolean; slugs?: string[] }) =>
    request<{ status: string; message?: string }>("/github/refresh", {
      method: "POST",
      body: JSON.stringify({
        force: opts?.force ?? false,
        background: opts?.background ?? true,
        slugs: opts?.slugs,
      }),
    }),
  retryStaleGithub: () =>
    request<{ stale_count: number; refreshed: number }>("/github/retry-stale", {
      method: "POST",
    }),
  gmailStatus: () =>
    request<{ ready: boolean; from_email?: string; error?: string }>("/gmail/status"),
  emailTemplate: () =>
    request<{
      body: string;
      placeholders: string[];
      team_name: string;
      role: string;
    }>("/email/template"),
  candidateEmails: (slug: string, runId?: number) => {
    const q = runId != null ? `?run_id=${runId}` : "";
    return request<EmailThread>(`/candidates/${slug}/emails${q}`);
  },
  previewCandidateEmail: (
    slug: string,
    body: { subject: string; body: string; reply?: boolean },
  ) =>
    request<{ to_email: string; to_name: string; subject: string; body: string }>(
      `/candidates/${slug}/emails/preview`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  sendCandidateEmail: (
    slug: string,
    body: { subject: string; body: string; analysis_run_id?: number; reply?: boolean },
  ) =>
    request<{
      ok: boolean;
      message: EmailMessage;
      note?: CandidateNote;
      status_updated?: boolean;
      error?: string;
    }>(`/candidates/${slug}/emails`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  sendBatchEmail: (body: {
    slugs: string[];
    subject: string;
    body: string;
    analysis_run_id?: number;
    reply?: boolean;
  }) =>
    request<{ total: number; sent: number; failed: number; results: unknown[] }>("/emails/batch", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  runEmails: (runId: number) =>
    request<{
      analysis_run_id: number;
      total_sent: number;
      messages: EmailMessage[];
      by_slug: Record<string, EmailMessage[]>;
    }>(`/analyze/runs/${runId}/emails`),
  contactedSlugs: (slugs: string[]) =>
    request<{ slugs: string[] }>(
      `/emails/contacted-slugs?slugs=${encodeURIComponent(slugs.join(","))}`,
    ),
  attachmentUrl: (slug: string, filename: string) =>
    `${API_BASE}/candidates/${slug}/attachment/${encodeURIComponent(filename)}`,
};
