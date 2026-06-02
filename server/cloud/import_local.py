"""One-time import of local filesystem candidates into cloud Postgres + Storage."""

from __future__ import annotations

from typing import Any

from server.cloud import candidates_repo as cloud
from server.config import CANDIDATES_DIR
from server.services.candidates import (
    get_candidate_full,
    load_manifest,
)
from server import db as local_db


def import_local_candidates(org_id: str) -> dict[str, Any]:
    manifest = load_manifest()
    imported = 0
    skipped = 0
    errors: list[str] = []

    for entry in manifest.get("candidates", []):
        slug = entry["slug"]
        try:
            if cloud.candidate_exists(org_id, slug):
                skipped += 1
                continue
            data = get_candidate_full(slug)
            if not data:
                skipped += 1
                continue

            for att in data.get("attachments", []):
                saved_as = att.get("saved_as", "")
                if not saved_as:
                    continue
                path = CANDIDATES_DIR / slug / "attachments" / saved_as
                if path.exists():
                    cloud.save_attachment(
                        org_id, slug, saved_as, path.read_bytes(),
                        mime_type=att.get("mime_type", "application/pdf"),
                        metadata={"filename": att.get("filename", saved_as)},
                    )

            for ext in data.get("extracted", []):
                cloud.save_extracted_text(org_id, slug, ext["filename"], ext.get("content", ""))

            cloud.upsert_candidate(org_id, {
                "slug": slug,
                "email": data.get("email") or entry.get("email", ""),
                "name": data.get("name") or entry.get("name", ""),
                "subject": data.get("subject") or entry.get("subject", ""),
                "received_at": data.get("received_at") or entry.get("received_at"),
                "github_urls": data.get("github_urls") or entry.get("github_urls", []),
                "attachment_count": data.get("attachment_count", 0),
                "primary_pdf": entry.get("primary_pdf"),
                "pdf_label": entry.get("pdf_label"),
                "metadata": data.get("metadata", {}),
                "links": data.get("links", {}),
                "email_text": data.get("email_text", ""),
            })
            imported += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{slug}: {exc}")

    notes_imported = _import_notes(org_id)
    runs_imported = _import_runs(org_id)

    return {
        "imported": imported,
        "skipped": skipped,
        "notes_imported": notes_imported,
        "runs_imported": runs_imported,
        "errors": errors,
    }


def _import_notes(org_id: str) -> int:
    from server.cloud import workflow_repo
    notes = local_db.list_all_notes()
    count = 0
    for slug, note in notes.items():
        if not cloud.candidate_exists(org_id, slug):
            continue
        workflow_repo.upsert_candidate_note(
            org_id, slug,
            status=note.get("status"),
            starred=note.get("starred"),
            notes=note.get("notes"),
            tags=note.get("tags"),
        )
        count += 1
    return count


def _import_runs(org_id: str) -> int:
    from server.cloud import workflow_repo
    count = 0
    for run in local_db.list_analysis_runs():
        full = local_db.get_analysis_run(run["id"])
        if not full:
            continue
        workflow_repo.save_analysis_run(org_id, full["name"], full["filter"], full["results"])
        count += 1
    return count
