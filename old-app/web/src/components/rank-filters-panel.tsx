"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { defaultRankFilters, type RankFiltersState } from "@/lib/rank-filters";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  tech_options: string[];
  location_presets: string[];
  experience_levels: { id: string; label: string }[];
  tier_options: { id: string; label: string }[];
  gender_note: string;
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1 text-left text-sm font-semibold"
      >
        {title}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-zinc-300 hover:border-indigo-400 dark:border-zinc-600",
      )}
    >
      {label}
    </button>
  );
}

function TriSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "" | "yes" | "no";
  onChange: (v: "" | "yes" | "no") => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs text-zinc-500">{label}</p>
      <div className="flex gap-1">
        {(["", "yes", "no"] as const).map((v) => (
          <button
            key={v || "any"}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs capitalize",
              value === v
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800",
            )}
          >
            {v === "" ? "Any" : v}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RankFiltersPanel({
  options,
  filters,
  onChange,
  stats,
  onPreview,
  previewLoading,
}: {
  options: FilterOptions;
  filters: RankFiltersState;
  onChange: (f: RankFiltersState) => void;
  stats: {
    total_synced: number;
    matched_pool: number;
    returned: number;
    exclusion_counts?: Record<string, number>;
  } | null;
  onPreview: () => void;
  previewLoading: boolean;
}) {
  const set = useCallback(
    (patch: Partial<RankFiltersState>) => onChange({ ...filters, ...patch }),
    [filters, onChange],
  );

  const toggleInList = (key: "tech_any" | "tech_all" | "locations" | "tiers", item: string) => {
    const list = filters[key];
    set({ [key]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] });
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <CardTitle>2. Filters & ranking</CardTitle>
          <p className="mt-1 text-sm text-zinc-500">
            Narrow the pool, preview how many match, then run the report.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onChange(defaultRankFilters())}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={onPreview}
            disabled={previewLoading}
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 dark:border-indigo-700"
          >
            {previewLoading ? "Previewing…" : "Preview pool"}
          </button>
        </div>
      </div>

      {stats && (
        <div className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-900 sm:grid-cols-3">
          <div>
            <p className="text-zinc-500">Synced</p>
            <p className="text-2xl font-bold">{stats.total_synced}</p>
          </div>
          <div>
            <p className="text-zinc-500">Match filters</p>
            <p className="text-2xl font-bold text-indigo-600">{stats.matched_pool}</p>
          </div>
          <div>
            <p className="text-zinc-500">Top N in report</p>
            <p className="text-2xl font-bold">{Math.min(filters.top_n, stats.matched_pool)}</p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Section title="Output">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Report name
                <input
                  value={filters.report_name}
                  onChange={(e) => set({ report_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="text-sm">
                Top N results
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={filters.top_n}
                  onChange={(e) => set({ top_n: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                Minimum score (0–100)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.min_score}
                  onChange={(e) =>
                    set({ min_score: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="Any"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>
          </Section>

          <Section title="Experience">
            <label className="block text-sm">
              Level
              <select
                value={filters.experience_level}
                onChange={(e) => set({ experience_level: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {options.experience_levels.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Min dev years
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={filters.min_dev_years}
                  onChange={(e) =>
                    set({ min_dev_years: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="Any"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="text-sm">
                Max dev years
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={filters.max_dev_years}
                  onChange={(e) =>
                    set({ max_dev_years: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="Any"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.filipino_only}
                  onChange={(e) => set({ filipino_only: e.target.checked })}
                />
                Filipino verified
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.exclude_auto_pass}
                  onChange={(e) => set({ exclude_auto_pass: e.target.checked })}
                />
                Exclude auto-pass (&gt;2yr)
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs text-zinc-500">Experience tiers</p>
              <div className="flex flex-wrap gap-2">
                {options.tier_options.map((t) => (
                  <ChipToggle
                    key={t.id}
                    label={t.label}
                    active={filters.tiers.includes(t.id)}
                    onClick={() => toggleInList("tiers", t.id)}
                  />
                ))}
              </div>
            </div>
          </Section>

          <Section title="Demographics (estimated)" defaultOpen={false}>
            <p className="text-xs text-amber-700 dark:text-amber-400">{options.gender_note}</p>
            <label className="block text-sm">
              Gender (from CV text)
              <select
                value={filters.gender}
                onChange={(e) => set({ gender: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="any">Any</option>
                <option value="female">Female signals</option>
                <option value="male">Male signals</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Min age
                <input
                  type="number"
                  min={16}
                  max={70}
                  value={filters.min_age}
                  onChange={(e) =>
                    set({ min_age: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="Any"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="text-sm">
                Max age
                <input
                  type="number"
                  min={16}
                  max={70}
                  value={filters.max_age}
                  onChange={(e) =>
                    set({ max_age: e.target.value === "" ? "" : Number(e.target.value) })
                  }
                  placeholder="Any"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Tech stack">
            <div>
              <p className="mb-2 text-xs text-zinc-500">Match any of these</p>
              <div className="flex flex-wrap gap-2">
                {options.tech_options.map((tech) => (
                  <ChipToggle
                    key={tech}
                    label={tech}
                    active={filters.tech_any.includes(tech)}
                    onClick={() => toggleInList("tech_any", tech)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs text-zinc-500">Must have all of these</p>
              <div className="flex flex-wrap gap-2">
                {options.tech_options.map((tech) => (
                  <ChipToggle
                    key={`all-${tech}`}
                    label={tech}
                    active={filters.tech_all.includes(tech)}
                    onClick={() => toggleInList("tech_all", tech)}
                  />
                ))}
              </div>
            </div>
            <TriSelect
              label="AI tools on CV"
              value={filters.has_ai_tools}
              onChange={(v) => set({ has_ai_tools: v })}
            />
            <TriSelect
              label="Academic honors"
              value={filters.has_honors}
              onChange={(v) => set({ has_honors: v })}
            />
          </Section>

          <Section title="GitHub & location">
            <TriSelect
              label="Has GitHub link"
              value={filters.has_github}
              onChange={(v) => set({ has_github: v })}
            />
            <label className="block text-sm">
              Minimum public repos
              <input
                type="number"
                min={0}
                value={filters.min_github_repos}
                onChange={(e) =>
                  set({
                    min_github_repos: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
                placeholder="Any (uses cached counts)"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <div>
              <p className="mb-2 text-xs text-zinc-500">Location (CV / email text)</p>
              <div className="flex flex-wrap gap-2">
                {options.location_presets.map((loc) => (
                  <ChipToggle
                    key={loc}
                    label={loc}
                    active={filters.locations.includes(loc)}
                    onClick={() => toggleInList("locations", loc)}
                  />
                ))}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </Card>
  );
}
