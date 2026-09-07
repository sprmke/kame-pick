import type { GitHubInsights } from '#/lib/types'
import { APP_SLUG } from '#/lib/brand'
import { getGithubCacheBulk, upsertGithubCache } from '#/server/workflow'

const GITHUB_USER_RE =
  /github\.com\/(?!orgs\/)([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)/i
const ACTIVE_REPO_DAYS = 90

export function parseGithubUsername(url: string): string | null {
  const match = url.match(GITHUB_USER_RE)
  if (!match) return null
  const login = match[1]!
  const reserved = new Set(['settings', 'notifications', 'explore', 'topics', 'collections', 'events'])
  if (reserved.has(login.toLowerCase())) return null
  return login
}

export function usernameFromUrls(urls: string[]): string | null {
  for (const url of urls) {
    const user = parseGithubUsername(url)
    if (user) return user
  }
  return null
}

function githubToken(): string | null {
  const token = process.env.GITHUB_TOKEN?.trim()
  return token || null
}

async function githubRequest(url: string): Promise<[Record<string, unknown> | null, string | null]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': APP_SLUG,
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const token = githubToken()
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetch(url, { headers })
    if (res.status === 404) return [null, 'User not found']
    if (res.status === 403) return [null, 'Rate limited']
    if (!res.ok) return [null, `HTTP ${res.status}`]
    return [(await res.json()) as Record<string, unknown>, null]
  } catch (e) {
    return [null, String(e)]
  }
}

function parseGithubDatetime(value: string | null | undefined): Date | null {
  if (!value) return null
  try {
    return new Date(value)
  } catch {
    return null
  }
}

function activityLabel(activeCount: number, daysSince: number | null): string {
  if (activeCount === 0) return 'Inactive (no pushes in 90 days)'
  if (daysSince == null) return 'Active'
  if (daysSince <= 7) return 'Very active'
  if (daysSince <= 30) return 'Active'
  if (daysSince <= 90) return 'Moderately active'
  return 'Inactive'
}

function repoSummary(r: Record<string, unknown>, now: Date) {
  const pushed = (r.pushed_at as string) || (r.updated_at as string)
  const pushedDt = parseGithubDatetime(pushed)
  const days = pushedDt ? Math.floor((now.getTime() - pushedDt.getTime()) / 86400000) : null
  return {
    name: r.name as string,
    url: r.html_url as string,
    description: ((r.description as string) || '').slice(0, 120) || null,
    language: r.language as string | null,
    stars: (r.stargazers_count as number) ?? 0,
    forks: (r.forks_count as number) ?? 0,
    is_fork: Boolean(r.fork),
    pushed_at: pushed ?? null,
    days_since_push: days,
    is_active: days != null && days <= ACTIVE_REPO_DAYS,
  }
}

export async function fetchGithubProfile(username: string): Promise<[Record<string, unknown> | null, string | null]> {
  const [userData, err] = await githubRequest(`https://api.github.com/users/${username}`)
  if (err || !userData) return [null, err]

  const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100&sort=pushed&direction=desc&type=owner`
  const [reposData, reposErr] = await githubRequest(reposUrl)
  const allRepos = Array.isArray(reposData) ? reposData : []
  const now = new Date()
  const owned = allRepos.filter((r) => !r.fork)
  const activeRepos = owned.filter((r) => {
    const pushed = parseGithubDatetime((r.pushed_at as string) || (r.updated_at as string))
    return pushed && (now.getTime() - pushed.getTime()) / 86400000 <= ACTIVE_REPO_DAYS
  })
  const topRepos = [...owned].sort((a, b) => ((b.stargazers_count as number) ?? 0) - ((a.stargazers_count as number) ?? 0)).slice(0, 6)
  const recentActive = [...activeRepos]
    .sort((a, b) => String(b.pushed_at).localeCompare(String(a.pushed_at)))
    .slice(0, 5)

  let lastPush: Date | null = null
  for (const repo of owned) {
    const pushed = parseGithubDatetime((repo.pushed_at as string) || (repo.updated_at as string))
    if (pushed && (!lastPush || pushed > lastPush)) lastPush = pushed
  }
  const daysSinceLast = lastPush ? Math.floor((now.getTime() - lastPush.getTime()) / 86400000) : null

  const profile = {
    username,
    profile_url: userData.html_url,
    avatar_url: userData.avatar_url,
    bio: userData.bio,
    public_repos: userData.public_repos ?? owned.length,
    followers: userData.followers ?? 0,
    following: userData.following ?? 0,
    account_created_at: userData.created_at,
    owned_repo_count: owned.length,
    fork_repos_count: allRepos.length - owned.length,
    active_repo_count: activeRepos.length,
    inactive_repo_count: Math.max(0, owned.length - activeRepos.length),
    is_active: activeRepos.length > 0,
    activity_label: activityLabel(activeRepos.length, daysSinceLast),
    last_pushed_at: lastPush?.toISOString() ?? null,
    days_since_last_push: daysSinceLast,
    total_stars: owned.reduce((s, r) => s + ((r.stargazers_count as number) ?? 0), 0),
    top_repos: topRepos.map((r) => repoSummary(r, now)),
    recent_active_repos: recentActive.map((r) => repoSummary(r, now)),
    fetched_at: now.toISOString(),
  }
  return [profile, reposErr === 'Rate limited' && !owned.length ? reposErr : null]
}

export async function getGithubProfile(username: string, refresh = false): Promise<GitHubInsights> {
  const key = username.toLowerCase()
  const cache = await getGithubCacheBulk([key])
  const row = cache.get(key)

  if (row && !refresh) {
    if (row.profile) return { username, ...row.profile, from_cache: true } as GitHubInsights
    if (row.error) return { username, error: row.error, from_cache: true }
  }

  const [profile, err] = await fetchGithubProfile(username)
  await upsertGithubCache(username, {
    public_repos: (profile?.public_repos as number) ?? null,
    error: err,
    profile,
  })

  if (err && !profile) return { username, error: err, from_cache: false }
  return { username, ...(profile ?? {}), from_cache: false } as GitHubInsights
}

export async function enrichEntriesWithGithub(entries: Array<Record<string, unknown>>) {
  const usernames: string[] = []
  for (const entry of entries) {
    const urls = (entry.github_urls as string[]) ?? []
    const user = usernameFromUrls(urls)
    entry.github_username = user
    if (user) usernames.push(user.toLowerCase())
  }
  const cache = await getGithubCacheBulk([...new Set(usernames)])
  for (const entry of entries) {
    const user = entry.github_username as string | null
    if (!user) {
      entry.github_repo_count = null
      entry.github_fetch_error = null
      continue
    }
    const row = cache.get(user.toLowerCase())
    const profile = row?.profile
    if (profile) {
      entry.github_repo_count = profile.public_repos
      entry.github_fetch_error = null
    } else if (row?.error) {
      entry.github_repo_count = row.public_repos
      entry.github_fetch_error = row.error
    } else {
      entry.github_repo_count = null
      entry.github_fetch_error = null
    }
  }
}

export async function githubApiStatus() {
  const token = githubToken()
  const [data, err] = await githubRequest('https://api.github.com/rate_limit')
  if (err || !data) {
    return { token_configured: Boolean(token), ok: false, error: err ?? 'Could not reach GitHub API' }
  }
  const core = (data.resources as { core?: Record<string, unknown> })?.core ?? {}
  return {
    token_configured: Boolean(token),
    ok: true,
    limit: core.limit,
    remaining: core.remaining,
    reset_at: core.reset,
    authenticated: Boolean(token) && Number(core.limit ?? 0) > 60,
  }
}

export async function refreshGithubStats(opts: { force?: boolean; slugs?: string[]; orgId: string; allEntries: Array<{ slug: string; github_urls: string[]; links?: { github: string[] } }> }) {
  let entries = opts.allEntries
  if (opts.slugs?.length) {
    const set = new Set(opts.slugs)
    entries = entries.filter((e) => set.has(e.slug))
  }
  const usernames = new Map<string, string>()
  for (const entry of entries) {
    const user = usernameFromUrls([...(entry.github_urls ?? []), ...(entry.links?.github ?? [])])
    if (user) usernames.set(user.toLowerCase(), user)
  }
  const cache = await getGithubCacheBulk([...usernames.keys()])
  const toFetch: string[] = []
  const now = Date.now()
  for (const [key, login] of usernames) {
    const row = cache.get(key)
    if (opts.force || !row || row.error || !row.profile) {
      toFetch.push(login)
      continue
    }
    const ageH = (now - new Date(row.fetched_at).getTime()) / 3600000
    if (ageH >= 24) toFetch.push(login)
  }
  let updated = 0
  let errors = 0
  for (let i = 0; i < toFetch.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, githubToken() ? 500 : 1500))
    const [profile, err] = await fetchGithubProfile(toFetch[i]!)
    await upsertGithubCache(toFetch[i]!, {
      public_repos: (profile?.public_repos as number) ?? null,
      error: err,
      profile,
    })
    if (err && !profile) errors++
    else updated++
  }
  return { total_profiles: usernames.size, fetched: toFetch.length, updated, errors }
}

export function refreshGithubStatsBackground(opts: Parameters<typeof refreshGithubStats>[0]) {
  void refreshGithubStats(opts)
}
