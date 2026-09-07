import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getDashboardFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const candidateService = await import('#/server/candidates')
  const ctx = await requireOrgContext()
  return candidateService.getDashboard(ctx.organizationId)
})

export const listCandidatesFn = createServerFn({ method: 'GET' })
  .validator(
    (data: {
      q?: string
      status?: string
      starred_only?: boolean
      has_github?: boolean
      sort?: string
      order?: 'asc' | 'desc'
      page?: number
      per_page?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const { enrichEntriesWithGithub } = await import('#/server/ranking')
    const ctx = await requireOrgContext()
    const result = await candidateService.listCandidates(ctx.organizationId, {
      q: data.q,
      status: data.status,
      starredOnly: data.starred_only,
      hasGithub: data.has_github,
      sort: data.sort,
      order: data.order,
      page: data.page,
      perPage: data.per_page,
    })
    await enrichEntriesWithGithub(result.candidates as Array<Record<string, unknown>>)
    return result
  })

export const getCandidateFn = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const ctx = await requireOrgContext()
    const candidate = await candidateService.getCandidate(ctx.organizationId, slug)
    if (!candidate) throw new Error('Candidate not found')
    return candidate
  })

const noteSchema = z.object({
  slug: z.string(),
  status: z.string().optional(),
  starred: z.boolean().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const updateCandidateNoteFn = createServerFn({ method: 'POST' })
  .validator((data: z.infer<typeof noteSchema>) => noteSchema.parse(data))
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const ctx = await requireOrgContext()
    if (!(await candidateService.candidateExists(ctx.organizationId, data.slug))) {
      throw new Error('Candidate not found')
    }
    return candidateService.upsertCandidateNote(ctx.organizationId, data.slug, data)
  })

export const getJobCriteriaFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const candidateService = await import('#/server/candidates')
  const ctx = await requireOrgContext()
  return candidateService.getJobCriteriaResponse(ctx.organizationId)
})

export const saveJobCriteriaFn = createServerFn({ method: 'POST' })
  .validator((content: string) => content)
  .handler(async ({ data: content }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const ctx = await requireOrgContext()
    const { parse: parseYaml } = await import('yaml')
    parseYaml(content)
    await candidateService.saveJobCriteria(ctx.organizationId, content)
    return { status: 'saved' as const }
  })

export const listReportsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const candidateService = await import('#/server/candidates')
  const ctx = await requireOrgContext()
  return { reports: await candidateService.listAnalysisRuns(ctx.organizationId) }
})

export const getReportFn = createServerFn({ method: 'GET' })
  .validator((runId: number) => runId)
  .handler(async ({ data: runId }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const { enrichRankedResults } = await import('#/server/ranking')
    const ctx = await requireOrgContext()
    const run = await candidateService.getAnalysisRun(ctx.organizationId, runId)
    if (!run) throw new Error('Report not found')
    run.results = await enrichRankedResults(ctx.organizationId, run.results ?? [])
    return run
  })

export const deleteReportFn = createServerFn({ method: 'POST' })
  .validator((runId: number) => runId)
  .handler(async ({ data: runId }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const ctx = await requireOrgContext()
    if (!(await candidateService.deleteAnalysisRun(ctx.organizationId, runId))) {
      throw new Error('Report not found')
    }
    return { status: 'deleted' as const }
  })

export const getFilterOptionsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const { getFilterOptions } = await import('#/server/filters')
  const ctx = await requireOrgContext()
  return getFilterOptions(ctx.organizationId)
})

export const previewRankFn = createServerFn({ method: 'POST' })
  .validator((body: Record<string, unknown>) => body)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { rankFilterFromDict, rankWithFilters } = await import('#/server/filters')
    const { getAllCandidatesForRanking } = await import('#/server/ranking')
    const ctx = await requireOrgContext()
    const cfg = rankFilterFromDict({ ...data, top_n: 0 })
    const entries = await getAllCandidatesForRanking(ctx.organizationId)
    const [, stats] = await rankWithFilters(ctx.organizationId, cfg, entries)
    return stats
  })

export const rankFn = createServerFn({ method: 'POST' })
  .validator((body: Record<string, unknown>) => body)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { rankFilterFromDict, rankWithFilters } = await import('#/server/filters')
    const { enrichRankedResults, getAllCandidatesForRanking } = await import('#/server/ranking')
    const candidateService = await import('#/server/candidates')
    const ctx = await requireOrgContext()
    const cfg = rankFilterFromDict(data)
    const entries = await getAllCandidatesForRanking(ctx.organizationId)
    const [ranked, stats] = await rankWithFilters(ctx.organizationId, cfg, entries)
    const enriched = await enrichRankedResults(ctx.organizationId, ranked)
    let runId: number | null = null
    if (data.save_run) {
      runId = await candidateService.saveAnalysisRun(
        ctx.organizationId,
        String(data.report_name ?? 'web-ranking'),
        data,
        enriched,
      )
    }
    return { ranked: enriched, count: enriched.length, filters: data, stats, run_id: runId }
  })

export const getGithubInsightsFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string; refresh?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const { getGithubProfile, usernameFromUrls } = await import('#/server/github')
    const ctx = await requireOrgContext()
    const candidate = await candidateService.getCandidate(ctx.organizationId, data.slug)
    if (!candidate) throw new Error('Candidate not found')
    const username = usernameFromUrls([...candidate.github_urls, ...candidate.links.github])
    if (!username) throw new Error('No GitHub URL for this candidate')
    return getGithubProfile(username, data.refresh ?? false)
  })

export const refreshGithubFn = createServerFn({ method: 'POST' })
  .validator((data: { force?: boolean; slugs?: string[] }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { refreshGithubStats } = await import('#/server/github')
    const { getAllCandidatesForRanking } = await import('#/server/ranking')
    const ctx = await requireOrgContext()
    const entries = await getAllCandidatesForRanking(ctx.organizationId)
    return refreshGithubStats({
      force: data.force,
      slugs: data.slugs,
      orgId: ctx.organizationId,
      allEntries: entries,
    })
  })

export const gmailStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const { gmailSendReady } = await import('#/server/email')
  const ctx = await requireOrgContext()
  return gmailSendReady(ctx.organizationId, ctx.userId)
})

export const emailTemplateFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDefaultEmailTemplate } = await import('#/server/email')
  return getDefaultEmailTemplate()
})

export const candidateEmailsFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string; run_id?: number }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { getEmailThread } = await import('#/server/email')
    const ctx = await requireOrgContext()
    return getEmailThread(ctx.organizationId, data.slug, data.run_id)
  })

export const previewEmailFn = createServerFn({ method: 'POST' })
  .validator((data: { slug: string; subject: string; body: string; reply?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { previewCandidateEmail } = await import('#/server/email')
    const ctx = await requireOrgContext()
    return previewCandidateEmail(ctx.organizationId, data.slug, data.subject, data.body, data.reply ?? true)
  })

export const sendEmailFn = createServerFn({ method: 'POST' })
  .validator(
    (data: { slug: string; subject: string; body: string; analysis_run_id?: number; reply?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { sendCandidateEmail } = await import('#/server/email')
    const ctx = await requireOrgContext()
    return sendCandidateEmail(
      ctx.organizationId,
      ctx.userId,
      data.slug,
      data.subject,
      data.body,
      data.analysis_run_id,
      data.reply ?? true,
    )
  })

export const batchEmailFn = createServerFn({ method: 'POST' })
  .validator(
    (data: { slugs: string[]; subject: string; body: string; analysis_run_id?: number; reply?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { sendBatchEmails } = await import('#/server/email')
    const ctx = await requireOrgContext()
    return sendBatchEmails(
      ctx.organizationId,
      ctx.userId,
      data.slugs,
      data.subject,
      data.body,
      data.analysis_run_id,
      data.reply ?? true,
    )
  })

export const runEmailsFn = createServerFn({ method: 'GET' })
  .validator((runId: number) => runId)
  .handler(async ({ data: runId }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { getRunEmailActivity } = await import('#/server/email')
    const ctx = await requireOrgContext()
    return getRunEmailActivity(ctx.organizationId, runId)
  })

export const contactedSlugsFn = createServerFn({ method: 'GET' })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const candidateService = await import('#/server/candidates')
    const ctx = await requireOrgContext()
    return { slugs: await candidateService.slugsWithSentOutbound(ctx.organizationId, slugs) }
  })

export const syncStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const { getSyncStatus } = await import('#/server/workflow')
  const ctx = await requireOrgContext()
  return getSyncStatus(ctx.organizationId)
})

export const syncFetchFn = createServerFn({ method: 'POST' })
  .validator((data: { only_new?: boolean; force?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { runFetchEmails } = await import('#/server/gmail-sync')
    const ctx = await requireOrgContext()
    runFetchEmails(ctx.organizationId, ctx.userId, data.only_new ?? true, data.force ?? false)
    return { status: 'started', job_type: 'fetch_emails' }
  })

export const syncExtractFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const { runExtractResumes } = await import('#/server/gmail-sync')
  const ctx = await requireOrgContext()
  runExtractResumes(ctx.organizationId)
  return { status: 'started', job_type: 'extract_resumes' }
})

export const syncFullFn = createServerFn({ method: 'POST' })
  .validator((data: { only_new?: boolean }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { runFullSync } = await import('#/server/gmail-sync')
    const ctx = await requireOrgContext()
    runFullSync(ctx.organizationId, ctx.userId, data.only_new ?? true)
    return { status: 'started', job_type: 'full_sync' }
  })

export const gmailConnectUrlFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const { buildAuthorizeUrl, oauthConfigured } = await import('#/server/gmail-oauth')
  const ctx = await requireOrgContext()
  if (!oauthConfigured()) throw new Error('Google OAuth not configured on server')
  return { url: await buildAuthorizeUrl(ctx.organizationId, ctx.userId) }
})

export const gmailDisconnectFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const { deleteConnection } = await import('#/server/gmail-oauth')
  const ctx = await requireOrgContext()
  await deleteConnection(ctx.organizationId, ctx.userId)
  return { status: 'disconnected' }
})

export const gmailCallbackFn = createServerFn({ method: 'POST' })
  .validator((data: { code: string; state: string }) => data)
  .handler(async ({ data }) => {
    const { exchangeCode } = await import('#/server/gmail-oauth')
    return exchangeCode(data.code, data.state)
  })

export const orgMeFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireOrgContext } = await import('#/server/auth')
  const ctx = await requireOrgContext()
  return {
    mode: 'cloud' as const,
    user_id: ctx.userId,
    email: ctx.email,
    organization_id: ctx.organizationId,
    org_role: ctx.orgRole,
  }
})

export const attachmentBytesFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string; filename: string }) => data)
  .handler(async ({ data }) => {
    const { requireOrgContext } = await import('#/server/auth')
    const { getAttachmentBytes } = await import('#/server/storage')
    const ctx = await requireOrgContext()
    const result = await getAttachmentBytes(ctx.organizationId, data.slug, data.filename)
    if (!result) throw new Error('Attachment not found')
    return {
      base64: result.bytes.toString('base64'),
      mimeType: result.mimeType,
      filename: result.filename,
    }
  })

export const githubStatusFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { githubApiStatus } = await import('#/server/github')
  return githubApiStatus()
})
