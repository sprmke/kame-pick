import Link from "next/link";
import { Suspense } from "react";
import { CandidatesPagination } from "@/app/candidates/candidates-pagination";
import { CandidatesTable } from "@/app/candidates/candidates-table";
import { CandidatesToolbar } from "@/app/candidates/candidates-toolbar";
import { parsePerPage } from "@/lib/candidates-pagination";
import { api, type CandidateListItem } from "@/lib/api";

export const dynamic = "force-dynamic";

async function CandidatesContent({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const q = searchParams.q || "";
  const status = searchParams.status || "";
  const sort = searchParams.sort || "score";
  const order = searchParams.order || "desc";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const perPage = parsePerPage(searchParams.per_page);

  let error: string | null = null;
  let candidates: CandidateListItem[] = [];
  let total = 0;
  let currentPage = page;
  let totalPages = 1;

  try {
    const res = await api.candidates({
      q,
      status: status || undefined,
      sort,
      order,
      starred_only: searchParams.starred === "1",
      has_github:
        searchParams.github === "1" ? true : searchParams.github === "0" ? false : undefined,
      include_scores: true,
      page,
      per_page: perPage,
    });
    candidates = res.candidates;
    total = res.total;
    currentPage = res.page;
    totalPages = res.total_pages;
  } catch (e) {
    error = e instanceof Error ? e.message : "API error";
  }

  if (error) return <p className="mb-4 text-red-600">{error}</p>;

  return (
    <>
      <Suspense fallback={<div className="h-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />}>
        <CandidatesToolbar />
      </Suspense>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />}>
        <CandidatesTable candidates={candidates} sort={sort} order={order} />
      </Suspense>
      <Suspense fallback={null}>
        <CandidatesPagination
          page={currentPage}
          perPage={perPage}
          total={total}
          totalPages={totalPages}
        />
      </Suspense>
    </>
  );
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-3xl font-bold">Candidates</h1>
      <CandidatesContent searchParams={params} />
    </div>
  );
}
