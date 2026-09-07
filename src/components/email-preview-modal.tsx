

export function EmailPreviewModal({
  open,
  onClose,
  preview,
  loading,
  error,
  note,
  toLabel,
  toRecipients,
}: {
  open: boolean;
  onClose: () => void;
  preview: {
    to_email: string;
    to_name: string;
    subject: string;
    body: string;
  } | null;
  loading?: boolean;
  error?: string;
  note?: string;
  /** Overrides the To line (e.g. batch send summary). */
  toLabel?: string;
  /** Shown under To when sending to multiple recipients. */
  toRecipients?: { name: string; email: string }[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Email preview</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Close
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-zinc-500">Rendering preview…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {preview && !loading && (
            <div className="space-y-4 text-sm">
              <p className="text-xs text-zinc-500">
                {note ||
                  "This is what will be sent. Placeholders are filled in for this candidate."}
              </p>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p>
                  <span className="text-zinc-500">To:</span>{" "}
                  <span className="font-medium">
                    {toLabel ??
                      (preview.to_name
                        ? `${preview.to_name} <${preview.to_email}>`
                        : preview.to_email)}
                  </span>
                </p>
                {toRecipients && toRecipients.length > 1 && (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-zinc-200 pt-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    {toRecipients.map((r) => (
                      <li key={r.email}>
                        {r.name} — {r.email}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2">
                  <span className="text-zinc-500">Subject:</span>{" "}
                  <span className="font-medium">{preview.subject}</span>
                </p>
                <pre className="mt-4 whitespace-pre-wrap font-sans text-zinc-800 dark:text-zinc-200">
                  {preview.body}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Back to edit
          </button>
        </div>
      </div>
    </div>
  );
}
