import { useCallback, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";

import { api } from "#/lib/api";

type GmailStatus = {
  ready: boolean
  from_email?: string | null
  error?: string
  connect_available?: boolean
  connected_at?: string
}

export function CloudSettingsPanel() {
  const search = useSearch({ strict: false }) as { gmail?: string; gmail_error?: string };
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [org, setOrg] = useState<{ organization_id?: string; email?: string; org_role?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [callbackNotice, setCallbackNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [g, o] = await Promise.all([api.gmailStatus(), api.orgMe()]);
      setGmail(g as GmailStatus);
      setOrg(o);
    } catch (e) {
      setGmail({ ready: false, error: e instanceof Error ? e.message : "Failed to load" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (search.gmail === "connected") {
      setCallbackNotice("Gmail connected successfully.");
      refresh();
    } else if (search.gmail === "error") {
      setCallbackNotice(search.gmail_error ?? "Gmail connection failed. Check Google OAuth redirect URI and env vars.");
    }
  }, [search.gmail, search.gmail_error, refresh]);

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
          Connect your Gmail account to sync applicants.
        </p>
        {callbackNotice && (
          <p
            className={`mt-3 text-sm ${callbackNotice.includes("success") ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}
          >
            {callbackNotice}
          </p>
        )}
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
    </section>
  );
}
