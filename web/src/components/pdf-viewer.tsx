"use client";

import { useCallback, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function pdfProxyUrl(slug: string, savedAs: string) {
  return `/pdf-proxy/${encodeURIComponent(slug)}/${encodeURIComponent(savedAs)}`;
}

export function PdfViewer({
  slug,
  savedAs,
  title,
  className,
}: {
  slug: string;
  savedAs: string;
  title: string;
  className?: string;
}) {
  const url = pdfProxyUrl(slug, savedAs);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPage(1);
    setLoading(false);
    setError(null);
  }, []);

  const onLoadError = useCallback(() => {
    setLoading(false);
    setError("Could not load PDF. Try opening in a new tab.");
  }, []);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-zinc-300 p-1.5 disabled:opacity-40 dark:border-zinc-700"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs text-zinc-500">
            {numPages ? `${page} / ${numPages}` : "—"}
          </span>
          <button
            type="button"
            disabled={page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            className="rounded-md border border-zinc-300 p-1.5 disabled:opacity-40 dark:border-zinc-700"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="rounded-md border border-zinc-300 p-1.5 dark:border-zinc-700"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2, s + 0.15))}
            className="rounded-md border border-zinc-300 p-1.5 dark:border-zinc-700"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="ml-1 rounded-md border border-zinc-300 px-2 py-1.5 text-xs dark:border-zinc-700"
          >
            Open tab
          </a>
        </div>
      </div>

      <div className="relative flex min-h-[480px] justify-center overflow-auto rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
        {loading && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
            Loading PDF…
          </p>
        )}
        {error ? (
          <p className="flex items-center justify-center p-8 text-sm text-red-600">{error}</p>
        ) : (
          <Document
            file={url}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading=""
            className="py-4"
          >
            <Page
              pageNumber={page}
              scale={scale}
              className="shadow-lg"
              renderTextLayer
              renderAnnotationLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}
