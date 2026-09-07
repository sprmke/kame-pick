

import { useCallback, useEffect, useState } from "react";

import { api } from "#/lib/api";
import { isCloudMode } from "#/lib/supabase/config";

export function CloudSettingsPanel() {
  const cloud = isCloudMode();
  const [gmail, setGmail] = useState<{ ready: boolean; from_email?: string; error?: string } | null>(null);
  const [org, setOrg] = useState<{ organization_id?: string; email?: string; org_role?: string } | null>(null);
  const [loading, setLoading] = useState(cloud);

  const refresh = useCallback(async () => {
    if (!cloud) return;
    setLoading(true);
    try {
      const [g, o] = await Promise.all([api.gmailStatus(), api.orgMe()]);
      setGmail(g);
      setOrg(o);
    } catch (e) {
      setGmail({ ready: false, error: e instanceof Error ? e.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, [cloud]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!cloud) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Cloud settings</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Running in local mode. Set Supabase env vars and DATABASE_URL on the API to enable cloud features.
        </p>
      </section>
    );
  }

  async function connectGmail() {
    const { url } = await api.gmailConnectUrl();
    window.location.href = url;
  }

  async function disconnectGmail() {
    await api.gmailDisconnect();
    refresh();
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Organization</h2>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-500">Loading…</p>
        ) : (
          <dl className="mt-3 space-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Account: </dt>
              <dd className="inline text-zinc-600 dark:text-zinc-400">{org?.email}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Role: </dt>
              <dd className="inline text-zinc-600 dark:text-zinc-400">{org?.org_role}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Gmail connection</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Connect your Gmail account to sync applicants in cloud mode.
        </p>
        {gmail?.ready ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
              Connected as {gmail.from_email}
            </span>
            <button
              type="button"
              onClick={disconnectGmail}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="mt-4">
            {gmail?.error && (
              <p className="mb-2 text-sm text-amber-700 dark:text-amber-300">{gmail.error}</p>
            )}
            <button
              type="button"
              onClick={connectGmail}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Connect Gmail
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Import local data</h2>
        <p className="mt-1 text-sm text-zinc-500">
          One-time migration from <code className="text-xs">data/candidates/</code> and SQLite notes into your cloud
          workspace. Run from your machine (requires local filesystem access):
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
          bun run migrate:local
        </pre>
        <p className="mt-2 text-xs text-zinc-500">
          Set <code>ORGANIZATION_ID</code> in <code>.env.local</code> before running.
        </p>
      </div>
    </section>
  );
}
