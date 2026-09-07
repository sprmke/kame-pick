"use client";

import { useMemo } from "react";
import { Settings2 } from "lucide-react";
import type { FilterOptions } from "@/components/rank-filters-panel";
import { RankFiltersReadonly } from "@/components/rank-filters-readonly";
import { fromRankPayload } from "@/lib/rank-filters";

export function RankingSettingsModal({
  open,
  onClose,
  runName,
  filter,
  filterOptions,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  runName: string;
  filter: Record<string, unknown>;
  filterOptions: FilterOptions;
  resultCount: number;
}) {
  const filters = useMemo(
    () => ({ ...fromRankPayload(filter), report_name: runName }),
    [filter, runName],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="ranking-settings-title"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 id="ranking-settings-title" className="text-lg font-semibold">
              Ranking settings
            </h2>
            <p className="text-sm text-zinc-500">Filters used when this report was created</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <RankFiltersReadonly
            filters={filters}
            options={filterOptions}
            resultCount={resultCount}
          />
        </div>
      </div>
    </div>
  );
}

export function RankingSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
    >
      <Settings2 className="h-4 w-4" />
      Ranking settings
    </button>
  );
}
