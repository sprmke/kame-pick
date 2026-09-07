"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

export type RankingSummary = {
  id: number;
  name: string;
  created_at: string;
};

export function RankingsList({ reports }: { reports: RankingSummary[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function remove(id: number, name: string) {
    if (!window.confirm(`Delete ranking "${name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(id);
    setError("");
    try {
      await api.deleteReport(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete ranking");
    } finally {
      setDeletingId(null);
    }
  }

  if (reports.length === 0) {
    return (
      <div className="mt-12 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <p className="text-zinc-500">No saved rankings yet.</p>
        <Link href="/analyze" className="mt-4 inline-block text-indigo-600 hover:underline">
          Run your first ranking analysis
        </Link>
      </div>
    );
  }

  return (
    <>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      <ul className="mt-8 space-y-2">
        {reports.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800"
          >
            <Link
              href={`/reports/${r.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-indigo-500" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-zinc-500">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <span className="text-sm text-indigo-600">Open →</span>
            </Link>
            <button
              type="button"
              onClick={() => remove(r.id, r.name)}
              disabled={deletingId === r.id}
              title={`Delete ${r.name}`}
              className="mr-3 shrink-0 rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
