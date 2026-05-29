import Link from "next/link";
import { Plus } from "lucide-react";
import { RankingsList } from "@/app/reports/rankings-list";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  let reports: Awaited<ReturnType<typeof api.reports>>["reports"] = [];
  try {
    reports = (await api.reports()).reports;
  } catch {
    /* offline */
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rankings</h1>
          <p className="mt-1 text-zinc-500">
            Review top candidates with inline PDF resume preview.
          </p>
        </div>
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New ranking
        </Link>
      </div>

      <RankingsList reports={reports} />
    </div>
  );
}
