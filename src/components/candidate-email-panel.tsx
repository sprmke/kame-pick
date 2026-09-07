

import type { EmailMessage } from "#/lib/api";
import { EmailPreviewModal } from "#/components/email-preview-modal";
import { Badge } from "#/components/ui/badge";
import { Card, CardTitle } from "#/components/ui/card";
import { useCandidateEmailPanel } from "#/lib/use-candidate-email-panel";

export function CandidateEmailPanel({
  slug,
  analysisRunId,
}: {
  slug: string;
  analysisRunId?: number;
}) {
  const {
    thread,
    filterRunId,
    setFilterRunId,
    subject,
    setSubject,
    body,
    setBody,
    placeholders,
    sending,
    previewOpen,
    setPreviewOpen,
    previewLoading,
    preview,
    previewError,
    error,
    gmailReady,
    sendMsg,
    showPreview,
    send,
  } = useCandidateEmailPanel(slug, analysisRunId);

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Email conversation</CardTitle>
        {analysisRunId != null && (
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterRunId("all")}
              className={`rounded-lg px-2 py-1 ${filterRunId === "all" ? "bg-indigo-600 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterRunId(analysisRunId)}
              className={`rounded-lg px-2 py-1 ${filterRunId === analysisRunId ? "bg-indigo-600 text-white" : "border border-zinc-300 dark:border-zinc-700"}`}
            >
              This ranking only
            </button>
          </div>
        )}
      </div>

      {gmailReady === false && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Gmail send is not ready. Re-authorize with send permission: delete <code>token.json</code> and
          run sync or send again to open the OAuth flow (scopes: read + send).
        </p>
      )}

      <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto">
        {thread?.messages.length ? (
          thread.messages.map((msg) => <EmailMessageCard key={String(msg.id)} message={msg} />)
        ) : (
          <p className="text-sm text-zinc-500">No messages yet. Inbound mail appears after Gmail sync.</p>
        )}
      </div>

      <div className="mt-6 space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {thread?.has_outbound ? "Reply" : "Compose shortlist email"}
        </p>
        <p className="text-xs text-zinc-500">
          Placeholders:{" "}
          {placeholders.map((p) => (
            <code key={p} className="mr-2">
              {`{{${p}}}`}
            </code>
          ))}
          — edit template in <code className="text-zinc-400">config/shortlist-email-template.txt</code>
        </p>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={22}
          className="w-full rounded-lg border border-zinc-300 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={showPreview}
            disabled={!subject.trim() || !body.trim()}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || gmailReady === false}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send email"}
          </button>
          {sendMsg && <span className="text-sm text-emerald-600">{sendMsg}</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>

      <EmailPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        preview={preview}
        loading={previewLoading}
        error={previewError}
      />
    </Card>
  );
}

function EmailMessageCard({ message }: { message: EmailMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${
        outbound
          ? "ml-8 border-indigo-200 bg-indigo-50/50 dark:border-indigo-900 dark:bg-indigo-950/30"
          : "mr-8 border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant={outbound ? "info" : "default"}>
          {outbound ? "You sent" : "Received"}
        </Badge>
        {message.analysis_run_id != null && (
          <Badge variant="default">Ranking #{message.analysis_run_id}</Badge>
        )}
        {message.status === "failed" && <Badge variant="danger">Failed</Badge>}
        <span className="text-xs text-zinc-500">
          {message.sent_at ? new Date(message.sent_at).toLocaleString() : ""}
        </span>
      </div>
      <p className="font-medium">{message.subject}</p>
      <p className="mt-1 text-xs text-zinc-500">
        {outbound ? `To: ${message.to_email}` : `From: ${message.from_email}`}
      </p>
      <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
        {message.body_text}
      </pre>
    </div>
  );
}
