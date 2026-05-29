"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

const PdfViewer = dynamic(
  () => import("@/components/pdf-viewer").then((m) => m.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[480px] items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
        Loading PDF viewer…
      </div>
    ),
  },
);

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

export function ResumeSection({
  slug,
  attachments,
  extracted,
}: {
  slug: string;
  attachments: Attachment[];
  extracted: Extracted[];
}) {
  const pdfs = useMemo(
    () =>
      attachments.filter(
        (a) => a.exists && (a.mime_type === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf")),
      ),
    [attachments],
  );

  const [activePdf, setActivePdf] = useState("");
  const [tab, setTab] = useState<"pdf" | "text">("pdf");

  useEffect(() => {
    if (pdfs.length && !activePdf) setActivePdf(pdfs[0].saved_as);
    if (!pdfs.length && extracted.length) setTab("text");
    else if (pdfs.length) setTab((t) => (t === "text" && !extracted.length ? "pdf" : t));
  }, [pdfs, extracted.length, activePdf]);

  const activeExtracted = useMemo(() => {
    if (!activePdf || !extracted.length) return extracted[0];
    const stem = activePdf.replace(/\.pdf$/i, "");
    return extracted.find((e) => e.filename.startsWith(stem) || e.filename.includes(stem)) ?? extracted[0];
  }, [activePdf, extracted]);

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
        <div className="flex flex-wrap gap-2">
          {pdfs.length > 0 && (
            <button
              type="button"
              onClick={() => setTab("pdf")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === "pdf"
                  ? "bg-indigo-600 text-white"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              PDF view
            </button>
          )}
          {extracted.length > 0 && (
            <button
              type="button"
              onClick={() => setTab("text")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === "text"
                  ? "bg-indigo-600 text-white"
                  : "border border-zinc-300 dark:border-zinc-700"
              }`}
            >
              Extracted text
            </button>
          )}
        </div>
      </div>

      {pdfs.length > 1 && tab === "pdf" && (
        <select
          value={activePdf}
          onChange={(e) => setActivePdf(e.target.value)}
          className="mt-4 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        >
          {pdfs.map((p) => (
            <option key={p.saved_as} value={p.saved_as}>
              {p.filename}
            </option>
          ))}
        </select>
      )}

      <div className="mt-4">
        {tab === "pdf" && activePdf && (
          <PdfViewer slug={slug} savedAs={activePdf} title={pdfs.find((p) => p.saved_as === activePdf)?.filename ?? activePdf} />
        )}
        {tab === "text" && activeExtracted && (
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
          {pdfs.map((att) => (
            <li key={att.saved_as}>
              <a
                href={api.attachmentUrl(slug, att.saved_as)}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline"
              >
                Download {att.filename}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
