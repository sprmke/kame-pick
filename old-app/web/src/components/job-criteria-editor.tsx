"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export function JobCriteriaEditor({
  initialContent,
  path,
  compact = false,
  embedded = false,
}: {
  initialContent: string;
  path: string;
  compact?: boolean;
  embedded?: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await api.saveJobCriteria(content);
      setMessage("Saved — ready to analyze");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const inner = (
    <>
      {!embedded && (
        <>
          <CardTitle>1. Job criteria</CardTitle>
          <p className="mt-1 text-sm text-zinc-500">
            Customize tech stack, weights, and filters in{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              {path || "config/job-criteria.yaml"}
            </code>
            , then save before running a ranking.
          </p>
        </>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={compact ? 16 : 22}
        className="mt-4 w-full rounded-lg border border-zinc-300 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
        spellCheck={false}
      />
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save criteria"}
        </button>
        {message && (
          <span
            className={`text-sm ${message.startsWith("Saved") ? "text-emerald-600" : "text-red-600"}`}
          >
            {message}
          </span>
        )}
      </div>
    </>
  );

  if (embedded) return inner;
  return <Card>{inner}</Card>;
}
