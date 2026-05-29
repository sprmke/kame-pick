import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingReview } from "@/components/ranking-review";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const runId = Number(id);
  if (Number.isNaN(runId)) notFound();

  let run;
  let filterOptions: Awaited<ReturnType<typeof api.filterOptions>>;
  try {
    [run, filterOptions] = await Promise.all([api.report(runId), api.filterOptions()]);
  } catch {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="shrink-0 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <Link href="/reports" className="text-sm text-indigo-600 hover:underline">
          ← All rankings
        </Link>
      </div>
      <RankingReview run={run} filterOptions={filterOptions} />
    </div>
  );
}
