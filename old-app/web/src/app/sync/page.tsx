import { SyncPanel } from "@/app/sync/sync-panel";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function SyncPage() {
  let status = null;
  try {
    status = await api.syncStatus();
  } catch {
    /* offline */
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Gmail Sync</h1>
      <p className="mt-1 max-w-2xl text-zinc-500">
        Pull new applicant emails from Gmail and extract PDF resume text. Requires{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">credentials.json</code> and{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env</code> configured per README.
      </p>
      <SyncPanel initialStatus={status} />
    </div>
  );
}
