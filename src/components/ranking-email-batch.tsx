

import { useEffect, useState } from 'react'
import { EmailPreviewModal } from '#/components/email-preview-modal'
import { api, type CandidateListItem } from '#/lib/api'

export function RankingEmailBatch({
  runId,
  candidates,
}: {
  runId: number;
  candidates: CandidateListItem[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("Re: Your application");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    to_email: string;
    to_name: string;
    subject: string;
    body: string;
  } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewNote, setPreviewNote] = useState("");
  const [previewToLabel, setPreviewToLabel] = useState<string>();
  const [previewToRecipients, setPreviewToRecipients] = useState<{ name: string; email: string }[]>();
  const [result, setResult] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [contactedSlugs, setContactedSlugs] = useState<Set<string>>(new Set());

  const eligibleCandidates = candidates.filter((c) => !contactedSlugs.has(c.slug));

  useEffect(() => {
    api.runEmails(runId).then((r) => setSentCount(r.total_sent)).catch(() => {});
  }, [runId, result]);

  useEffect(() => {
    if (!open) return;
    const slugs = candidates.map((c) => c.slug);
    void (async () => {
      const [t, contacted] = await Promise.all([
        api.emailTemplate(),
        api.contactedSlugs(slugs),
      ]);
      const contactedSet = new Set(contacted.slugs);
      setBody(t.body);
      setContactedSlugs(contactedSet);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const slug of prev) {
          if (contactedSet.has(slug)) next.delete(slug);
        }
        return next;
      });
    })().catch(() => {});
  }, [open, candidates, result]);

  function toggle(slug: string) {
    if (contactedSlugs.has(slug)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectTop(n: number) {
    setSelected(new Set(eligibleCandidates.slice(0, n).map((c) => c.slug)));
  }

  function selectAllEligible() {
    setSelected(new Set(eligibleCandidates.map((c) => c.slug)));
  }

  async function showPreview() {
    const slugs = [...selected];
    if (!slugs.length || !subject.trim() || !body.trim()) {
      setResult("Select candidates and fill subject/body to preview");
      return;
    }
    const selectedList = candidates.filter((c) => slugs.includes(c.slug));
    const first = selectedList[0];
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    setPreviewToRecipients(
      selectedList.map((c) => ({ name: c.name, email: c.email || "" })),
    );
    if (slugs.length === 1 && first) {
      setPreviewToLabel(`${first.name} <${first.email}>`);
      setPreviewNote("This is what will be sent to this candidate.");
    } else {
      setPreviewToLabel(
        `${slugs.length} selected candidates (one personalized email each)`,
      );
      setPreviewNote(
        `Body below is a sample for ${first?.name || slugs[0]}. Each recipient gets their own email with their {{first_name}} filled in.`,
      );
    }
    try {
      const data = await api.previewCandidateEmail(slugs[0], { subject, body, reply: true });
      setPreview(data);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function sendBatch() {
    const slugs = [...selected];
    if (!slugs.length) {
      setResult("Select at least one candidate");
      return;
    }
    setBusy(true);
    setResult("");
    try {
      const res = await api.sendBatchEmail({
        slugs,
        subject,
        body,
        analysis_run_id: runId,
        reply: true,
      });
      setResult(`Sent ${res.sent} of ${res.total}${res.failed ? ` (${res.failed} failed)` : ""}`);
      setSelected(new Set());
      const contacted = await api.contactedSlugs(candidates.map((c) => c.slug));
      setContactedSlugs(new Set(contacted.slugs));
      setOpen(false)
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Batch send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-600 dark:border-indigo-700"
      >
        Email candidates{sentCount > 0 ? ` (${sentCount} sent)` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Batch email — ranking #{runId}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                Close
              </button>
            </div>

            <p className="mb-3 text-xs text-zinc-500">
              Emails are tagged with this ranking report. Use{" "}
              <code>{"{{first_name}}"}</code> for personalization. Sends as replies when a thread exists.
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => selectTop(5)} className="text-xs text-indigo-600 hover:underline">
                Top 5
              </button>
              <button type="button" onClick={() => selectTop(10)} className="text-xs text-indigo-600 hover:underline">
                Top 10
              </button>
              <button
                type="button"
                onClick={selectAllEligible}
                className="text-xs text-indigo-600 hover:underline"
              >
                All ({eligibleCandidates.length})
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-zinc-500 hover:underline">
                Clear
              </button>
            </div>

            <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              {candidates.map((c, i) => {
                const alreadyEmailed = contactedSlugs.has(c.slug);
                return (
                  <label
                    key={c.slug}
                    className={`flex items-center gap-2 border-b border-zinc-100 px-3 py-2 text-sm last:border-0 dark:border-zinc-800 ${
                      alreadyEmailed
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.slug)}
                      disabled={alreadyEmailed}
                      onChange={() => toggle(c.slug)}
                    />
                    <span className="text-zinc-500">#{i + 1}</span>
                    <span className="font-medium">{c.name}</span>
                    <span className="truncate text-zinc-500">{c.email}</span>
                    {alreadyEmailed && (
                      <span className="ml-auto shrink-0 text-xs text-zinc-500">Already emailed</span>
                    )}
                  </label>
                );
              })}
            </div>

            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Subject"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={22}
              className="mb-4 w-full rounded-lg border border-zinc-300 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={showPreview}
                disabled={selected.size === 0 || !subject.trim() || !body.trim()}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={sendBatch}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Sending…" : `Send to ${selected.size} selected`}
              </button>
              {result && <span className="text-sm text-zinc-600 dark:text-zinc-400">{result}</span>}
            </div>
          </div>
        </div>
      )}

      <EmailPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        preview={preview}
        loading={previewLoading}
        error={previewError}
        note={previewNote}
        toLabel={previewToLabel}
        toRecipients={previewToRecipients}
      />
    </>
  );
}
