"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { JobCriteriaEditor } from "@/components/job-criteria-editor";
import { RankFiltersPanel, type FilterOptions } from "@/components/rank-filters-panel";
import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { defaultRankFilters, toRankPayload, type RankFiltersState } from "@/lib/rank-filters";

export function AnalyzeWorkspace({
  criteriaContent,
  criteriaPath,
  filterOptions,
  initialRuns,
}: {
  criteriaContent: string;
  criteriaPath: string;
  filterOptions: FilterOptions;
  initialRuns: { id: number; name: string; created_at: string }[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<RankFiltersState>(defaultRankFilters);
  const [stats, setStats] = useState<{
    total_synced: number;
    matched_pool: number;
    returned: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState("");
  const [criteriaOpen, setCriteriaOpen] = useState(false);

  const runPreview = useCallback(async () => {
    setPreviewLoading(true);
    setError("");
    try {
      const s = await api.previewRank({ ...toRankPayload(filters), save_run: false });
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    runPreview();
    // Initial pool stats on page load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAnalysis() {
    setRunLoading(true);
    setError("");
    try {
      const res = await api.rank({ ...toRankPayload(filters), save_run: true });
      if (res.run_id) {
        router.push(`/reports/${res.run_id}`);
      } else {
        setError("Ranking completed but was not saved.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setRunLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={() => setCriteriaOpen(!criteriaOpen)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        >
          <div className="min-w-0 flex-1">
            <CardTitle>1. Job criteria</CardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              {criteriaOpen ? "Click to collapse" : "Click to edit YAML before ranking"}
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 dark:border-indigo-700">
            {criteriaOpen ? "Hide" : "Show"}
          </span>
        </button>
        {criteriaOpen && (
          <div className="border-t border-zinc-100 px-6 pb-6 pt-4 dark:border-zinc-800">
            <JobCriteriaEditor
              initialContent={criteriaContent}
              path={criteriaPath}
              compact
              embedded
            />
          </div>
        )}
      </Card>

      <RankFiltersPanel
        options={filterOptions}
        filters={filters}
        onChange={setFilters}
        stats={stats}
        onPreview={runPreview}
        previewLoading={previewLoading}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={runLoading || previewLoading}
          className="rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {runLoading ? "Building report…" : "Run & open report"}
        </button>
        {stats && (
          <p className="text-sm text-zinc-500">
            Will rank top <strong>{Math.min(filters.top_n, stats.matched_pool)}</strong> of{" "}
            <strong>{stats.matched_pool}</strong> matching candidates
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {initialRuns.length > 0 && (
        <Card>
          <CardTitle>3. Saved rankings</CardTitle>
          <ul className="mt-4 space-y-2 text-sm">
            {initialRuns.map((run) => (
              <li key={run.id}>
                <Link href={`/reports/${run.id}`} className="text-indigo-600 hover:underline">
                  {run.name} — {new Date(run.created_at).toLocaleString()}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
