import { AnalyzeWorkspace } from "@/app/analyze/analyze-workspace";
import type { FilterOptions } from "@/components/rank-filters-panel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const defaultFilterOptions: FilterOptions = {
  tech_options: [
    "HTML",
    "CSS",
    "JavaScript",
    "TypeScript",
    "React",
    "Next.js",
    "Supabase",
    "Node.js",
  ],
  location_presets: ["Pampanga", "Region III", "Metro Manila", "Philippines"],
  experience_levels: [
    { id: "any", label: "Any experience level" },
    { id: "fresh_grad", label: "Fresh grad / no paid dev" },
    { id: "has_work_exp", label: "Has dev work experience" },
    { id: "intern_only", label: "Intern / OJT only" },
  ],
  tier_options: [
    { id: "tier_a", label: "Tier A (junior ≤2yr)" },
    { id: "tier_b", label: "Tier B (fresh grad)" },
  ],
  gender_note: "Gender is estimated from CV/email text — not guaranteed accurate.",
};

export default async function AnalyzePage() {
  let criteria = { raw: "", path: "config/job-criteria.yaml" };
  let runs: Awaited<ReturnType<typeof api.analysisRuns>>["runs"] = [];
  let filterOptions = defaultFilterOptions;

  try {
    const [criteriaRes, runsRes, optionsRes] = await Promise.all([
      api.jobCriteria(),
      api.analysisRuns(),
      api.filterOptions(),
    ]);
    criteria = { raw: criteriaRes.raw, path: criteriaRes.path };
    runs = runsRes.runs;
    filterOptions = optionsRes;
  } catch {
    /* API offline */
  }

  return (
    <div className="p-8 pb-16">
      <h1 className="text-3xl font-bold">Rank & Analyze</h1>
      <p className="mt-1 max-w-2xl text-zinc-500">
        Set job criteria, apply filters (tech stack, experience, location, GitHub, and more), preview
        the candidate pool, then open an interactive ranking with PDF resumes.
      </p>
      <AnalyzeWorkspace
        criteriaContent={criteria.raw}
        criteriaPath={criteria.path}
        filterOptions={filterOptions}
        initialRuns={runs}
      />
    </div>
  );
}
