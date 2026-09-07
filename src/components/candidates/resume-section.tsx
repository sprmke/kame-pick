import { lazy, Suspense, useMemo, useState } from 'react'
import { Card, CardTitle } from '#/components/ui/card'
import { api } from '#/lib/api'

const PdfViewer = lazy(() => import('#/components/pdf-viewer').then((m) => ({ default: m.PdfViewer })))

type Attachment = {
  filename: string;
  saved_as: string;
  mime_type: string;
  exists: boolean;
};

type Extracted = {
  filename: string;
  chars: number;
  content: string;
};

type ResumeTab = "pdf" | "text";

function isPdfAttachment(attachment: Attachment): boolean {
  return attachment.exists && (attachment.mime_type === "application/pdf" || attachment.filename.toLowerCase().endsWith(".pdf"));
}

function resolveInitialTab(pdfs: Attachment[], extracted: Extracted[]): ResumeTab {
  if (!pdfs.length && extracted.length) return "text";
  return "pdf";
}

function findExtractedForPdf(activePdf: string, extracted: Extracted[]): Extracted | undefined {
  if (!activePdf || !extracted.length) return extracted[0];
  const stem = activePdf.replace(/\.pdf$/i, "");
  return extracted.find((entry) => entry.filename.startsWith(stem) || entry.filename.includes(stem)) ?? extracted[0];
}

function ResumeTabBar({
  tab,
  onTabChange,
  hasPdf,
  hasText,
}: {
  tab: ResumeTab;
  onTabChange: (tab: ResumeTab) => void;
  hasPdf: boolean;
  hasText: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {hasPdf && (
        <button
          type="button"
          onClick={() => onTabChange("pdf")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "pdf" ? "bg-indigo-600 text-white" : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          PDF view
        </button>
      )}
      {hasText && (
        <button
          type="button"
          onClick={() => onTabChange("text")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === "text" ? "bg-indigo-600 text-white" : "border border-zinc-300 dark:border-zinc-700"
          }`}
        >
          Extracted text
        </button>
      )}
    </div>
  );
}

export function ResumeSection({
  slug,
  attachments,
  extracted,
}: {
  slug: string;
  attachments: Attachment[];
  extracted: Extracted[];
}) {
  const pdfs = useMemo(() => attachments.filter(isPdfAttachment), [attachments]);
  const defaultPdf = pdfs[0]?.saved_as ?? "";
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const activePdf = selectedPdf ?? defaultPdf;
  const [tab, setTab] = useState<ResumeTab>(() => resolveInitialTab(pdfs, extracted));
  const effectiveTab =
    tab === "text" && pdfs.length > 0 && extracted.length === 0 ? "pdf" : tab;

  const activeExtracted = useMemo(
    () => findExtractedForPdf(activePdf, extracted),
    [activePdf, extracted],
  );

  if (!pdfs.length && !extracted.length) {
    return (
      <Card className="lg:col-span-2">
        <CardTitle>Resume</CardTitle>
        <p className="mt-4 text-sm text-zinc-500">No resume attachments or extracted text.</p>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Resume</CardTitle>
        <ResumeTabBar
          tab={effectiveTab}
          onTabChange={setTab}
          hasPdf={pdfs.length > 0}
          hasText={extracted.length > 0}
        />
      </div>

      {pdfs.length > 1 && effectiveTab === "pdf" && (
        <select
          value={activePdf}
          onChange={(e) => setSelectedPdf(e.target.value)}
          className="mt-4 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {pdfs.map((pdf) => (
            <option key={pdf.saved_as} value={pdf.saved_as}>
              {pdf.filename}
            </option>
          ))}
        </select>
      )}

      <div className="mt-4">
        {effectiveTab === "pdf" && activePdf && (
          <Suspense
            fallback={
              <div className="flex min-h-[480px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                Loading PDF viewer…
              </div>
            }
          >
            <PdfViewer
              slug={slug}
              savedAs={activePdf}
              title={pdfs.find((pdf) => pdf.saved_as === activePdf)?.filename ?? activePdf}
            />
          </Suspense>
        )}
        {effectiveTab === "text" && activeExtracted && (
          <>
            <p className="mb-2 text-xs text-zinc-500">
              {activeExtracted.filename} · {activeExtracted.chars.toLocaleString()} characters
            </p>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-xs dark:bg-zinc-950">
              {activeExtracted.content}
            </pre>
          </>
        )}
      </div>

      {pdfs.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-3 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
          {pdfs.map((attachment) => (
            <li key={attachment.saved_as}>
              <a
                href={api.attachmentUrl(slug, attachment.saved_as)}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Download {attachment.filename}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
