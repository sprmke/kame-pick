"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { FilterOptions } from "@/components/rank-filters-panel";
import { RankingSettingsButton, RankingSettingsModal } from "@/components/ranking-settings-modal";
import { ExternalLink, Mail } from "lucide-react";
import { ScoreBadge, TierBadge } from "@/components/score-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { GithubReposCell } from "@/components/github-repos-cell";
import { RankingEmailBatch } from "@/components/ranking-email-batch";
import type { CandidateListItem } from "@/lib/api";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => m.PdfViewer),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading PDF…</div> },
);

export function RankingReview({
  run,
  filterOptions,
}: {
  run: {
    id: number;
    name: string;
    filter: Record<string, unknown>;
    created_at: string;
    results: CandidateListItem[];
  };
  filterOptions: FilterOptions;
}) {
  const results = run.results;
  const [selectedSlug, setSelectedSlug] = useState(results[0]?.slug ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selected = useMemo(
    () => results.find((c) => c.slug === selectedSlug) ?? results[0],
    [results, selectedSlug],
  );

  const sc = selected?.score;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{run.name}</h1>
            <p className="text-sm text-zinc-500">
              {new Date(run.created_at).toLocaleString()} · {results.length} candidates
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RankingSettingsButton onClick={() => setSettingsOpen(true)} />
            <RankingEmailBatch runId={run.id} candidates={results} />
          </div>
        </div>
      </div>

      <RankingSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        runName={run.name}
        filter={run.filter}
        filterOptions={filterOptions}
        resultCount={results.length}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-zinc-200 dark:border-zinc-800">
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {results.map((c, i) => {
              const active = c.slug === selected?.slug;
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(c.slug)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      active ? "bg-indigo-600/10 ring-1 ring-inset ring-indigo-600/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-500">#{i + 1}</p>
                        <p className="truncate font-semibold">
                          {c.note?.starred && <span className="mr-1 text-amber-500">★</span>}
                          {c.name}
                        </p>
                        <p className="truncate text-xs text-zinc-500">{c.email}</p>
                      </div>
                      <ScoreBadge score={c.score} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.note?.status && c.note.status !== "new" && (
                        <StatusBadge status={c.note.status} />
                      )}
                      <TierBadge tier={c.score?.experience_tier} />
                      {c.primary_pdf ? (
                        <Badge variant="info">PDF</Badge>
                      ) : (
                        <Badge variant="warning">No PDF</Badge>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      {selected.note?.starred && <span className="mr-1 text-amber-500">★</span>}
                      {selected.name}
                    </h2>
                    <p className="flex items-center gap-1 text-sm text-zinc-500">
                      <Mail className="h-3.5 w-3.5" />
                      {selected.email}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {selected.note?.status && selected.note.status !== "new" && (
                        <StatusBadge status={selected.note.status} />
                      )}
                      <ScoreBadge score={sc} />
                      <TierBadge tier={sc?.experience_tier} />
                      <GithubReposCell
                        githubUrls={selected.github_urls}
                        githubUsername={selected.github_username}
                        githubRepoCount={selected.github_repo_count}
                        githubFetchError={selected.github_fetch_error}
                      />
                      <Link
                        href={`/candidates/${selected.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Full profile <ExternalLink className="inline h-3 w-3" />
                      </Link>
                      <Link
                        href={`/candidates/${selected.slug}?run_id=${run.id}`}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Email thread
                      </Link>
                    </div>
                  </div>
                  {sc && (
                    <dl className="grid max-w-md gap-1 text-xs text-zinc-500 sm:grid-cols-2">
                      <div>
                        <dt className="inline">Tech: </dt>
                        <dd className="inline text-zinc-300">{sc.tech_preferred_met.slice(0, 4).join(", ") || "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline">Git: </dt>
                        <dd className="inline text-zinc-300">{sc.git_evidence || "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline">Honors: </dt>
                        <dd className="inline text-zinc-300">{sc.honors_found.join(", ") || "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline">Exp: </dt>
                        <dd className="inline text-zinc-300">
                          {sc.experience_years ?? "?"} yrs · {sc.experience_tier}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-4">
                {selected.primary_pdf ? (
                  <PdfViewer
                    slug={selected.slug}
                    savedAs={selected.primary_pdf}
                    title={selected.pdf_label ?? selected.primary_pdf}
                    className="h-full"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
                    <p className="text-zinc-500">No PDF resume on file for this candidate.</p>
                    <Link
                      href={`/candidates/${selected.slug}`}
                      className="mt-3 text-sm text-indigo-600 hover:underline"
                    >
                      View email & extracted text
                    </Link>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="p-8 text-zinc-500">No candidates in this ranking.</p>
          )}
        </div>
      </div>
    </div>
  );
}
