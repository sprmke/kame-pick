"""Enrich ranked candidate rows for interactive report UI."""

from __future__ import annotations

from typing import Any

from server.db import list_all_notes
from server.services.candidates import list_attachments
from server.services.github import enrich_entries_with_github


def _default_note(slug: str) -> dict[str, Any]:
    return {"slug": slug, "status": "new", "starred": False, "notes": "", "tags": []}


def enrich_ranked_results(ranked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    notes = list_all_notes()
    for item in ranked:
        slug = item["slug"]
        item["note"] = notes.get(slug) or _default_note(slug)

    enrich_entries_with_github(ranked)
    for item in ranked:
        slug = item["slug"]
        pdfs = [
            a
            for a in list_attachments(slug)
            if a.get("exists")
            and (
                a.get("mime_type") == "application/pdf"
                or str(a.get("filename", "")).lower().endswith(".pdf")
            )
        ]
        if pdfs:
            item["primary_pdf"] = pdfs[0]["saved_as"]
            item["pdf_label"] = pdfs[0]["filename"]
        else:
            item["primary_pdf"] = None
            item["pdf_label"] = None
    return ranked
