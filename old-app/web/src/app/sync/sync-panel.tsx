"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { api, type SyncJob } from "@/lib/api";

type SyncStatus = Awaited<ReturnType<typeof api.syncStatus>> | null;
type SyncAction = "fetch" | "extract" | "full";

const SYNC_ACTIONS: { action: SyncAction; label: string; primary?: boolean }[] = [
  { action: "full", label: "Full sync (fetch + extract)", primary: true },
  { action: "fetch", label: "Fetch emails only" },
  { action: "extract", label: "Extract PDFs only" },
];

function jobStatusClass(status: string): string {
  if (status === "success") return "text-emerald-600";
  if (status === "running") return "text-amber-600";
  return "text-red-600";
}

function JobStatus({ label, job }: { label: string; job: SyncJob | null }) {
  if (!job) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
        <p className="font-medium">{label}</p>
        <p className="mt-1">Not run from the web UI yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <p className="font-medium">{label}</p>
      <p className="mt-1 capitalize">
        Status: <span className={jobStatusClass(job.status)}>{job.status}</span>
      </p>
      <p className="text-xs text-zinc-500">
        Started {new Date(job.started_at).toLocaleString()}
        {job.finished_at && ` · Finished ${new Date(job.finished_at).toLocaleString()}`}
      </p>
      {job.message && (
        <pre className="mt-2 max-h-32 overflow-auto rounded bg-zinc-50 p-2 text-xs dark:bg-zinc-950">
          {job.message.slice(-1500)}
        </pre>
      )}
    </div>
  );
}

async function startSyncAction(action: SyncAction): Promise<void> {
  if (action === "fetch") {
    await api.syncFetch(true, false);
    return;
  }
  if (action === "extract") {
    await api.syncExtract();
    return;
  }
  await api.syncFull(true);
}

export function SyncPanel({ initialStatus }: { initialStatus: SyncStatus }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    try {
      setStatus(await api.syncStatus());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function run(action: SyncAction) {
    setBusy(true);
    setMessage("");
    try {
      await startSyncAction(action);
      setMessage(`${action} started — polling status…`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <Card>
        <CardTitle>Actions</CardTitle>
        <div className="mt-4 flex flex-wrap gap-3">
          {SYNC_ACTIONS.map(({ action, label, primary }) => (
            <button
              key={action}
              type="button"
              disabled={busy}
              onClick={() => run(action)}
              className={
                primary
                  ? "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  : "rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              }
            >
              {label}
            </button>
          ))}
        </div>
        {message && <p className="mt-3 text-sm text-zinc-600">{message}</p>}
        {status?.extract?.status === "success" && !status?.fetch && (
          <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
            PDF extraction finished. Use &quot;Fetch emails only&quot; or &quot;Full sync&quot; to pull new Gmail applicants.
          </p>
        )}
        {status && !status.candidates_dir_exists && (
          <p className="mt-3 text-sm text-amber-700">
            No candidates folder yet — run fetch after Gmail OAuth setup.
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <JobStatus label="Full sync" job={status?.full ?? null} />
        <JobStatus label="Fetch emails" job={status?.fetch ?? null} />
        <JobStatus label="Extract PDFs" job={status?.extract ?? null} />
      </div>
    </div>
  );
}
