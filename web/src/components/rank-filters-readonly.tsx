"use client";

import type { ReactNode } from "react";
import type { FilterOptions } from "@/components/rank-filters-panel";
import type { RankFiltersState } from "@/lib/rank-filters";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function ChipList({ items, empty = "Any" }: { items: string[]; empty?: string }) {
  if (!items.length) {
    return <span className="text-sm font-medium text-zinc-400">{empty}</span>;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-indigo-600/40 bg-indigo-600/10 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function triLabel(v: "" | "yes" | "no") {
  if (v === "yes") return "Yes";
  if (v === "no") return "No";
  return "Any";
}

function numLabel(v: number | "", suffix = "") {
  if (v === "") return "Any";
  return `${v}${suffix}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function RankFiltersReadonly({
  filters,
  options,
  resultCount,
}: {
  filters: RankFiltersState;
  options: FilterOptions;
  resultCount: number;
}) {
  const expLabel =
    options.experience_levels.find((o) => o.id === filters.experience_level)?.label ??
    filters.experience_level;

  const tierLabels = filters.tiers.map(
    (id) => options.tier_options.find((t) => t.id === id)?.label ?? id,
  );

  const genderLabel =
    filters.gender === "any"
      ? "Any"
      : filters.gender === "female"
        ? "Female signals"
        : filters.gender === "male"
          ? "Male signals"
          : filters.gender;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-950">
        <span className="text-zinc-500">Candidates in this report: </span>
        <span className="font-semibold">{resultCount}</span>
        <span className="text-zinc-500"> (top {filters.top_n} by score)</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Section title="Output">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Report name" value={filters.report_name} />
              <Field label="Top N results" value={filters.top_n} />
              <Field label="Minimum score" value={numLabel(filters.min_score, "/100")} />
            </div>
          </Section>

          <Section title="Experience">
            <Field label="Level" value={expLabel} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min dev years" value={numLabel(filters.min_dev_years)} />
              <Field label="Max dev years" value={numLabel(filters.max_dev_years)} />
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Field label="Filipino verified" value={filters.filipino_only ? "Yes" : "No"} />
              <Field
                label="Exclude auto-pass (>2yr)"
                value={filters.exclude_auto_pass ? "Yes" : "No"}
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Experience tiers</p>
              <ChipList items={tierLabels} />
            </div>
          </Section>

          <Section title="Demographics (estimated)">
            <p className="text-xs text-amber-700 dark:text-amber-400">{options.gender_note}</p>
            <Field label="Gender (from CV text)" value={genderLabel} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min age" value={numLabel(filters.min_age)} />
              <Field label="Max age" value={numLabel(filters.max_age)} />
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Tech stack">
            <div>
              <p className="text-xs text-zinc-500">Match any of these</p>
              <ChipList items={filters.tech_any} />
            </div>
            <div>
              <p className="text-xs text-zinc-500">Must have all of these</p>
              <ChipList items={filters.tech_all} />
            </div>
            <Field label="AI tools on CV" value={triLabel(filters.has_ai_tools)} />
            <Field label="Academic honors" value={triLabel(filters.has_honors)} />
          </Section>

          <Section title="GitHub & location">
            <Field label="Has GitHub link" value={triLabel(filters.has_github)} />
            <Field label="Minimum public repos" value={numLabel(filters.min_github_repos)} />
            <div>
              <p className="text-xs text-zinc-500">Location (CV / email text)</p>
              <ChipList items={filters.locations} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
