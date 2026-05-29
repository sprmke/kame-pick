"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function CandidatesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") || "";
  const [q, setQ] = useState(urlQ);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete("page");
      router.push(`/candidates?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (q === urlQ) return;
    const timer = setTimeout(() => update("q", q), 300);
    return () => clearTimeout(timer);
  }, [q, urlQ, update]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input
        type="search"
        placeholder="Search name, email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            update("q", q);
          }
        }}
        className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-none sm:min-w-[14rem]"
      />
      <select
        value={searchParams.get("sort") || "score"}
        onChange={(e) => {
          const sort = e.target.value;
          const params = new URLSearchParams(searchParams.toString());
          params.set("sort", sort);
          const ascDefault = sort === "name" || sort === "status";
          params.set("order", ascDefault ? "asc" : "desc");
          params.delete("page");
          router.push(`/candidates?${params.toString()}`);
        }}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="score">Sort by score</option>
        <option value="received_at">Sort by date</option>
        <option value="name">Sort by name</option>
        <option value="github_repos">Sort by repo</option>
        <option value="tier">Sort by tier</option>
        <option value="status">Sort by status</option>
      </select>
      <select
        value={searchParams.get("status") || ""}
        onChange={(e) => update("status", e.target.value)}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="shortlisted">Shortlisted</option>
        <option value="interview">Interview</option>
        <option value="rejected">Rejected</option>
        <option value="hired">Hired</option>
      </select>
      <button
        type="button"
        onClick={() => update("starred", searchParams.get("starred") === "1" ? "" : "1")}
        className={`rounded-lg border px-3 py-2 text-sm ${
          searchParams.get("starred") === "1"
            ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        ★ Starred
      </button>
    </div>
  );
}
