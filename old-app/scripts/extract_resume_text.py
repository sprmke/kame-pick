"""Extract text from candidate PDF attachments for faster AI review."""

from __future__ import annotations

import argparse
import json
import logging
import warnings
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES_DIR = ROOT.parent / "data" / "candidates"

# Benign pdfminer/pypdf noise on some resume fonts — does not affect extracted text.
for _logger in ("pdfminer", "pdfplumber", "PIL"):
    logging.getLogger(_logger).setLevel(logging.ERROR)
warnings.filterwarnings("ignore", message=".*FontBBox.*")
warnings.filterwarnings("ignore", category=UserWarning, module="pdfminer")


def extract_pdf_text(pdf_path: Path) -> str:
    chunks: list[str] = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                chunks.append(f"--- Page {i} ---\n{text}")
    return "\n\n".join(chunks)


def process_candidate(candidate_dir: Path) -> tuple[int, int, list[str]]:
    """Returns (pdfs_ok, pdfs_failed, errors)."""
    attachments_dir = candidate_dir / "attachments"
    if not attachments_dir.exists():
        return 0, 0, []

    extracted_dir = candidate_dir / "extracted"
    extracted_dir.mkdir(exist_ok=True)
    index: list[dict] = []
    ok = 0
    failed = 0
    errors: list[str] = []

    for pdf in sorted(attachments_dir.glob("*.pdf")):
        out = extracted_dir / f"{pdf.stem}.txt"
        try:
            text = extract_pdf_text(pdf)
            out.write_text(text, encoding="utf-8")
            index.append({"source": pdf.name, "extracted": out.name, "chars": len(text)})
            ok += 1
        except Exception as exc:  # noqa: BLE001 — log per-file failures
            index.append({"source": pdf.name, "error": str(exc)})
            failed += 1
            errors.append(f"{candidate_dir.name}/{pdf.name}: {exc}")

    if index:
        (extracted_dir / "index.json").write_text(json.dumps(index, indent=2), encoding="utf-8")

    return ok, failed, errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract text from candidate PDF resumes")
    parser.add_argument("--slug", help="Process one candidate folder slug only")
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Print summary only (for API/background runs)",
    )
    args = parser.parse_args()

    if not CANDIDATES_DIR.exists():
        print(f"No candidates dir at {CANDIDATES_DIR}")
        return

    dirs = [CANDIDATES_DIR / args.slug] if args.slug else [p for p in CANDIDATES_DIR.iterdir() if p.is_dir()]

    candidates_processed = 0
    total_ok = 0
    total_failed = 0
    all_errors: list[str] = []

    for d in sorted(dirs):
        if d.name.startswith("."):
            continue
        ok, failed, errors = process_candidate(d)
        if ok or failed:
            candidates_processed += 1
        total_ok += ok
        total_failed += failed
        all_errors.extend(errors)
        if not args.quiet:
            print(f"Processed PDFs: {d.name}")

    summary = (
        f"Done. {candidates_processed} candidates, {total_ok} PDFs extracted"
        + (f", {total_failed} failed" if total_failed else "")
    )
    print(summary)
    if all_errors and not args.quiet:
        print("Errors:")
        for err in all_errors[:20]:
            print(f"  - {err}")
        if len(all_errors) > 20:
            print(f"  … and {len(all_errors) - 20} more")


if __name__ == "__main__":
    main()
