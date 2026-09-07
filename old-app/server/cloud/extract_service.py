"""PDF text extraction for cloud-stored attachments."""

from __future__ import annotations

import io
import logging
import warnings

import pdfplumber

for _logger in ("pdfminer", "pdfplumber", "PIL"):
    logging.getLogger(_logger).setLevel(logging.ERROR)
warnings.filterwarnings("ignore", message=".*FontBBox.*")

from server.cloud import candidates_repo as candidates


def extract_pdf_bytes(data: bytes) -> str:
    chunks: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                chunks.append(f"--- Page {i} ---\n{text}")
    return "\n\n".join(chunks)


def extract_all_for_org(org_id: str, *, slug: str | None = None) -> int:
    manifest = candidates.load_manifest(org_id)
    entries = manifest.get("candidates", [])
    if slug:
        entries = [e for e in entries if e["slug"] == slug]

    count = 0
    for entry in entries:
        s = entry["slug"]
        for att in candidates.list_attachments(org_id, s):
            saved_as = att.get("saved_as", "")
            if not saved_as.lower().endswith(".pdf") and "pdf" not in (att.get("mime_type") or "").lower():
                continue
            txt_name = saved_as.rsplit(".", 1)[0] + ".txt" if "." in saved_as else saved_as + ".txt"
            existing = candidates.load_extracted_texts(org_id, s)
            if any(e["filename"] == txt_name for e in existing):
                continue
            result = candidates.get_attachment_bytes(org_id, s, saved_as)
            if not result:
                continue
            data, _mime = result
            text = extract_pdf_bytes(data)
            if text.strip():
                candidates.save_extracted_text(org_id, s, txt_name, text)
                count += 1
    return count
