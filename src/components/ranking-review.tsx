import { Link, useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { FilterOptions } from "#/components/rank-filters-panel";
import { RankingSettingsButton, RankingSettingsModal } from "#/components/ranking-settings-modal";
import { ExternalLink, Mail } from "lucide-react";
import { ScoreBadge, TierBadge } from "#/components/score-badge";
import { StatusBadge } from "#/components/status-badge";
import { Badge } from "#/components/ui/badge";
import { GithubReposCell } from "#/components/github-repos-cell";
import { RankingEmailBatch } from "#/components/ranking-email-batch";
import type { CandidateListItem, ScoreBreakdown } from "#/lib/api";

const PdfViewer = lazy(() => import('#/components/pdf-viewer').then((m) => ({ default: m.PdfViewer })))

type RankingRunView = {
  id: number;
  name: string;
  filter: Record<string, unknown>;
  created_at: string;
  results: CandidateListItem[];
};

function RankingCandidateRow({
  candidate,
  rank,
  active,
  onSelect,
}: {
  candidate: CandidateListItem;
  rank: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full px-4 py-3 text-left transition-colors ${
          active ? "bg-indigo-600/10 ring-1 ring-inset ring-indigo-600/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500">#{rank}</p>
            <p className="truncate font-semibold">
              {candidate.note?.starred && <span className="mr-1 text-amber-500">★</span>}
              {candidate.name}
            </p>
            <p className="truncate text-xs text-zinc-500">{candidate.email}</p>
          </div>
          <ScoreBadge score={candidate.score} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {candidate.note?.status && candidate.note.status !== "new" && (
            <StatusBadge status={candidate.note.status} />
          )}
          <TierBadge tier={candidate.score?.experience_tier} />
          {candidate.primary_pdf ? (
            <Badge variant="info">PDF</Badge>
          ) : (
            <Badge variant="warning">No PDF</Badge>
          )}
        </div>
      </button>
    </li>
  );
}

function ScoreSummary({ score }: { score: ScoreBreakdown }) {
  return (
    <dl className="grid max-w-md gap-1 text-xs text-zinc-500 sm:grid-cols-2">
      <div>
        <dt className="inline">Tech: </dt>
        <dd className="inline text-zinc-300">{score.tech_preferred_met.slice(0, 4).join(", ") || "—"}</dd>
      </div>
      <div>
        <dt className="inline">Git: </dt>
        <dd className="inline text-zinc-300">{score.git_evidence || "—"}</dd>
      </div>
      <div>
        <dt className="inline">Honors: </dt>
        <dd className="inline text-zinc-300">{score.honors_found.join(", ") || "—"}</dd>
      </div>
      <div>
        <dt className="inline">Exp: </dt>
        <dd className="inline text-zinc-300">
          {score.experience_years ?? "?"} yrs · {score.experience_tier}
        </dd>
      </div>
    </dl>
  );
}

function SelectedCandidateHeader({
  candidate,
  runId,
  score,
}: {
  candidate: CandidateListItem;
  runId: number;
  score?: ScoreBreakdown;
}) {
  return (
    <div className="shrink-0 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {candidate.note?.starred && <span className="mr-1 text-amber-500">★</span>}
            {candidate.name}
          </h2>
          <p className="flex items-center gap-1 text-sm text-zinc-500">
            <Mail className="h-3.5 w-3.5" />
            {candidate.email}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {candidate.note?.status && candidate.note.status !== "new" && (
              <StatusBadge status={candidate.note.status} />
            )}
            <ScoreBadge score={score} />
            <TierBadge tier={score?.experience_tier} />
            <GithubReposCell
              githubUrls={candidate.github_urls}
              githubUsername={candidate.github_username}
              githubRepoCount={candidate.github_repo_count}
              githubFetchError={candidate.github_fetch_error}
            />
            <Link
              to="/candidates/$slug"
              params={{ slug: candidate.slug }}
              target="_blank"
              className="text-sm text-indigo-600 hover:underline"
            >
              Full profile <ExternalLink className="inline h-3 w-3" />
            </Link>
            <Link
              to="/candidates/$slug"
              params={{ slug: candidate.slug }}
              search={{ run_id: runId }}
              className="text-sm text-indigo-600 hover:underline"
            >
              Email thread
            </Link>
          </div>
        </div>
        {score && <ScoreSummary score={score} />}
      </div>
    </div>
  );
}

function SelectedCandidateResume({ candidate }: { candidate: CandidateListItem }) {
  if (candidate.primary_pdf) {
    return (
      <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-zinc-500">Loading PDF…</div>}>
        <PdfViewer
          slug={candidate.slug}
          savedAs={candidate.primary_pdf}
          title={candidate.pdf_label ?? candidate.primary_pdf}
          className="h-full"
        />
      </Suspense>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="text-zinc-500">No PDF resume on file for this candidate.</p>
      <Link
        to="/candidates/$slug"
        params={{ slug: candidate.slug }}
        className="mt-3 text-sm text-indigo-600 hover:underline"
      >
        View email & extracted text
      </Link>
    </div>
  );
}

export function RankingReview({
  run,
  filterOptions,
}: {
  run: RankingRunView;
  filterOptions: FilterOptions;
}) {
  const results = run.results;
  const [selectedSlug, setSelectedSlug] = useState(results[0]?.slug ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selected = useMemo(
    () => results.find((c) => c.slug === selectedSlug) ?? results[0],
    [results, selectedSlug],
  );

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
            {results.map((candidate, index) => (
              <RankingCandidateRow
                key={candidate.slug}
                candidate={candidate}
                rank={index + 1}
                active={candidate.slug === selected?.slug}
                onSelect={() => setSelectedSlug(candidate.slug)}
              />
            ))}
          </ol>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selected ? (
            <>
              <SelectedCandidateHeader candidate={selected} runId={run.id} score={selected.score} />
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <SelectedCandidateResume candidate={selected} />
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
