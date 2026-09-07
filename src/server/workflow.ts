import { and, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '#/db'
import { githubCache, syncJobs } from '#/db/schema'
import type { GitHubInsights, ScoreBreakdown, SyncJob } from '#/lib/types'

export async function getGithubCacheBulk(usernames: string[]) {
  if (!usernames.length) return new Map<string, { public_repos: number | null; fetched_at: string; error: string | null; profile: Record<string, unknown> | null }>()
  const db = getDb()
  const keys = [...new Set(usernames.map((u) => u.toLowerCase()))]
  const rows = await db.query.githubCache.findMany({
    where: inArray(githubCache.username, keys),
  })
  const map = new Map<string, { public_repos: number | null; fetched_at: string; error: string | null; profile: Record<string, unknown> | null }>()
  for (const row of rows) {
    map.set(row.username, {
      public_repos: row.publicRepos,
      fetched_at: row.fetchedAt.toISOString(),
      error: row.error,
      profile: row.profileJson as Record<string, unknown> | null,
    })
  }
  return map
}

export async function upsertGithubCache(
  username: string,
  data: { public_repos?: number | null; error?: string | null; profile?: Record<string, unknown> | null },
) {
  const db = getDb()
  const key = username.toLowerCase()
  const isRateLimit = data.error?.toLowerCase().includes('rate')
  const existing = await db.query.githubCache.findFirst({ where: eq(githubCache.username, key) })

  if (isRateLimit && existing?.profileJson) {
    await db
      .update(githubCache)
      .set({ error: data.error, fetchedAt: existing.fetchedAt })
      .where(eq(githubCache.username, key))
    return
  }

  await db
    .insert(githubCache)
    .values({
      username: key,
      publicRepos: data.public_repos ?? null,
      fetchedAt: new Date(),
      error: data.error ?? null,
      profileJson: data.profile ?? null,
    })
    .onConflictDoUpdate({
      target: githubCache.username,
      set: {
        publicRepos: data.public_repos ?? sql`${githubCache.publicRepos}`,
        fetchedAt: new Date(),
        error: data.error ?? null,
        profileJson: data.profile ?? sql`${githubCache.profileJson}`,
      },
    })
}

export async function createSyncJob(orgId: string, jobType: string): Promise<number> {
  const db = getDb()
  const [row] = await db
    .insert(syncJobs)
    .values({ organizationId: orgId, jobType, status: 'running', message: '' })
    .returning({ id: syncJobs.id })
  return row!.id
}

export async function finishSyncJob(jobId: number, status: string, message: string) {
  const db = getDb()
  await db
    .update(syncJobs)
    .set({ status, message, finishedAt: new Date() })
    .where(eq(syncJobs.id, jobId))
}

export async function getLatestSyncJob(orgId: string, jobType?: string): Promise<SyncJob | null> {
  const db = getDb()
  const row = jobType
    ? await db.query.syncJobs.findFirst({
        where: and(eq(syncJobs.organizationId, orgId), eq(syncJobs.jobType, jobType)),
        orderBy: (j, { desc }) => [desc(j.id)],
      })
    : await db.query.syncJobs.findFirst({
        where: eq(syncJobs.organizationId, orgId),
        orderBy: (j, { desc }) => [desc(j.id)],
      })
  if (!row) return null
  return {
    id: row.id,
    job_type: row.jobType,
    status: row.status,
    message: row.message,
    started_at: row.startedAt.toISOString(),
    finished_at: row.finishedAt?.toISOString(),
  }
}

export async function getSyncStatus(orgId: string) {
  const [fetch, extract, full] = await Promise.all([
    getLatestSyncJob(orgId, 'fetch_emails'),
    getLatestSyncJob(orgId, 'extract_resumes'),
    getLatestSyncJob(orgId, 'full_sync'),
  ])
  return { fetch, extract, full, candidates_dir_exists: true }
}

export type { ScoreBreakdown, GitHubInsights }
