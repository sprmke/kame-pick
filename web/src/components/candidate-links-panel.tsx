"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Star,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { api, type GitHubInsights } from "@/lib/api";
import { cn } from "@/lib/utils";

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function formatRelativeDays(days: number | null | undefined) {
  if (days == null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function PortfolioPreview({ url }: { url: string }) {
  const [blocked, setBlocked] = useState(false);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
        <span className="truncate text-zinc-500">{url}</span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex shrink-0 items-center gap-1 text-indigo-600 hover:underline"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {!blocked ? (
        <iframe
          src={url}
          title="Portfolio preview"
          className="h-[32rem] w-full bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onError={() => setBlocked(true)}
        />
      ) : (
        <div className="flex h-[32rem] flex-col items-center justify-center gap-2 bg-zinc-50 p-4 text-center text-sm text-zinc-500 dark:bg-zinc-950">
          <p>Preview blocked by this site (X-Frame-Options).</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
            Open portfolio in new tab
          </a>
        </div>
      )}
    </div>
  );
}

export function CandidateLinksPanel({
  slug,
  githubUrls,
  linkedinUrls,
  portfolioUrls,
}: {
  slug: string;
  githubUrls: string[];
  linkedinUrls: string[];
  portfolioUrls: string[];
}) {
  const [gh, setGh] = useState<GitHubInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadGithub = useCallback(
    async (refresh = false) => {
      if (!githubUrls.length) return;
      setLoading(true);
      setError("");
      try {
        const data = await api.githubInsights(slug, refresh);
        setGh(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load GitHub");
      } finally {
        setLoading(false);
      }
    },
    [slug, githubUrls.length],
  );

  useEffect(() => {
    loadGithub(false);
  }, [loadGithub]);

  const hasLinks = githubUrls.length || linkedinUrls.length || portfolioUrls.length;

  return (
    <Card className="lg:col-span-2">
      <CardTitle>Links & portfolio</CardTitle>

      {!hasLinks && <p className="mt-4 text-sm text-zinc-500">No links extracted from email or CV.</p>}

      {githubUrls.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-indigo-500" />
              <h3 className="font-semibold">GitHub</h3>
              {gh?.username && (
                <a
                  href={gh.profile_url || githubUrls[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-indigo-600 hover:underline"
                >
                  @{gh.username}
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => loadGithub(true)}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-700"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
          </div>

          {loading && !gh && (
            <p className="mt-4 text-sm text-zinc-500">Loading GitHub activity…</p>
          )}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {gh?.error && !gh.public_repos && (
            <p className="mt-4 text-sm text-amber-600">
              {gh.error === "Rate limited"
                ? "GitHub rate limit — add GITHUB_TOKEN to .env or retry later."
                : gh.error}
            </p>
          )}

          {gh && !gh.error && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={gh.is_active ? "success" : "warning"}>{gh.activity_label}</Badge>
                {gh.last_pushed_at && (
                  <span className="text-xs text-zinc-500">
                    Last push {formatRelativeDays(gh.days_since_last_push)}
                  </span>
                )}
              </div>

              {gh.bio && <p className="text-sm text-zinc-600 dark:text-zinc-400">{gh.bio}</p>}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="Public repos" value={gh.public_repos ?? "—"} />
                <StatBox
                  label="Active repos"
                  value={gh.active_repo_count ?? 0}
                  sub={`pushed in last 90 days`}
                />
                <StatBox
                  label="Inactive repos"
                  value={gh.inactive_repo_count ?? 0}
                  sub="no recent pushes"
                />
                <StatBox label="Total stars" value={gh.total_stars ?? 0} />
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {gh.followers ?? 0} followers
                </span>
                <span>{gh.following ?? 0} following</span>
                {gh.fork_repos_count != null && gh.fork_repos_count > 0 && (
                  <span>{gh.fork_repos_count} forked</span>
                )}
                {gh.account_created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {new Date(gh.account_created_at).getFullYear()}
                  </span>
                )}
              </div>

              {(gh.recent_active_repos?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Recently active repos
                  </p>
                  <ul className="space-y-2">
                    {gh.recent_active_repos?.map((repo) => (
                      <li
                        key={repo.url}
                        className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {repo.name}
                          </a>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            {repo.language && <span>{repo.language}</span>}
                            {(repo.stars ?? 0) > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Star className="h-3 w-3" />
                                {repo.stars}
                              </span>
                            )}
                            <span>{formatRelativeDays(repo.days_since_push)}</span>
                          </div>
                        </div>
                        {repo.description && (
                          <p className="mt-1 text-xs text-zinc-500">{repo.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(gh.top_repos?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Top repos by stars
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {gh.top_repos?.slice(0, 5).map((repo) => (
                      <li key={repo.url}>
                        <a
                          href={repo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs hover:border-indigo-400 dark:border-zinc-700"
                        >
                          {repo.name}
                          {(repo.stars ?? 0) > 0 && (
                            <span className="text-zinc-500">★{repo.stars}</span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {gh?.error && gh.public_repos != null && (
            <p className="mt-2 text-xs text-zinc-500">Partial data — {gh.error}</p>
          )}
        </section>
      )}

      {linkedinUrls.length > 0 && (
        <section className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h3 className="font-semibold">LinkedIn</h3>
          <ul className="mt-2 space-y-1">
            {linkedinUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 hover:underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {portfolioUrls.length > 0 && (
        <section className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          <h3 className="font-semibold">Portfolio & websites</h3>
          {portfolioUrls.map((url) => (
            <PortfolioPreview key={url} url={url} />
          ))}
        </section>
      )}
    </Card>
  );
}
