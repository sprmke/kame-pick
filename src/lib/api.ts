import type {
  CandidateListItem,
  CandidateNote,
  EmailMessage,
  EmailThread,
  GitHubInsights,
  ScoreBreakdown,
  SyncJob,
} from '#/lib/types'
import {
  batchEmailFn,
  candidateEmailsFn,
  contactedSlugsFn,
  deleteReportFn,
  emailTemplateFn,
  getCandidateFn,
  getFilterOptionsFn,
  getGithubInsightsFn,
  getJobCriteriaFn,
  getReportFn,
  gmailConnectUrlFn,
  gmailDisconnectFn,
  gmailStatusFn,
  listCandidatesFn,
  listReportsFn,
  orgMeFn,
  previewEmailFn,
  previewRankFn,
  rankFn,
  refreshGithubFn,
  runEmailsFn,
  saveJobCriteriaFn,
  sendEmailFn,
  syncExtractFn,
  syncFetchFn,
  syncFullFn,
  syncStatusFn,
  updateCandidateNoteFn,
} from '#/server/functions'

export type { CandidateListItem, CandidateNote, EmailMessage, EmailThread, GitHubInsights, ScoreBreakdown, SyncJob }

export function attachmentUrl(slug: string, filename: string) {
  return `/pdf-proxy/${encodeURIComponent(slug)}/${encodeURIComponent(filename)}`
}

export const api = {
  candidates: (params?: Record<string, string | number | boolean | undefined>) =>
    listCandidatesFn({ data: params ?? {} }),
  candidate: (slug: string) => getCandidateFn({ data: slug }),
  updateNote: (slug: string, body: Partial<CandidateNote>) =>
    updateCandidateNoteFn({ data: { slug, ...body } }),
  filterOptions: () => getFilterOptionsFn(),
  previewRank: (body: Record<string, unknown>) => previewRankFn({ data: body }),
  rank: (body: Record<string, unknown>) => rankFn({ data: body }),
  reports: () => listReportsFn(),
  report: (id: number) => getReportFn({ data: id }),
  deleteReport: (id: number) => deleteReportFn({ data: id }),
  jobCriteria: () => getJobCriteriaFn(),
  saveJobCriteria: (content: string) => saveJobCriteriaFn({ data: content }),
  syncFetch: (onlyNew = true, force = false) => syncFetchFn({ data: { only_new: onlyNew, force } }),
  syncExtract: () => syncExtractFn(),
  syncFull: (onlyNew = true) => syncFullFn({ data: { only_new: onlyNew } }),
  syncStatus: () => syncStatusFn(),
  refreshGithubStats: (opts?: { force?: boolean; background?: boolean; slugs?: string[] }) => {
    if (opts?.background) {
      void refreshGithubFn({ data: { force: opts.force, slugs: opts.slugs } })
      return Promise.resolve({ status: 'started', message: 'GitHub refresh started' })
    }
    return refreshGithubFn({ data: { force: opts?.force, slugs: opts?.slugs } })
  },
  gmailStatus: () => gmailStatusFn(),
  emailTemplate: () => emailTemplateFn(),
  candidateEmails: (slug: string, runId?: number) =>
    candidateEmailsFn({ data: { slug, run_id: runId } }),
  previewCandidateEmail: (slug: string, body: { subject: string; body: string; reply?: boolean }) =>
    previewEmailFn({ data: { slug, ...body } }),
  sendCandidateEmail: (
    slug: string,
    body: { subject: string; body: string; analysis_run_id?: number; reply?: boolean },
  ) => sendEmailFn({ data: { slug, ...body } }),
  sendBatchEmail: (body: {
    slugs: string[]
    subject: string
    body: string
    analysis_run_id?: number
    reply?: boolean
  }) => batchEmailFn({ data: body }),
  runEmails: (runId: number) => runEmailsFn({ data: runId }),
  contactedSlugs: (slugs: string[]) => contactedSlugsFn({ data: slugs }),
  githubInsights: (slug: string, refresh = false) =>
    getGithubInsightsFn({ data: { slug, refresh } }),
  attachmentUrl,
  orgMe: () => orgMeFn(),
  gmailConnectUrl: () => gmailConnectUrlFn(),
  gmailDisconnect: () => gmailDisconnectFn(),
}
