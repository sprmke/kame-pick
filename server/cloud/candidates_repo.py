"""Cloud candidate repository — Postgres + optional Supabase Storage."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from server.cloud.pg import execute, execute_returning, fetch_all, fetch_one
from server.cloud.storage import download_bytes, storage_path, upload_bytes


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_manifest(org_id: str) -> dict[str, Any]:
    rows = fetch_all(
        """
        SELECT slug, email, name, subject, received_at, github_urls,
               attachment_count, primary_pdf, pdf_label, updated_at
        FROM candidates
        WHERE organization_id = %s
        ORDER BY received_at DESC NULLS LAST, slug
        """,
        (org_id,),
    )
    candidates = []
    latest_update: datetime | None = None
    for row in rows:
        received = row["received_at"]
        if received and (latest_update is None or received > latest_update):
            latest_update = received
        candidates.append({
            "slug": row["slug"],
            "email": row["email"] or "",
            "name": row["name"] or "",
            "subject": row["subject"] or "",
            "received_at": received.isoformat() if hasattr(received, "isoformat") else (str(received) if received else ""),
            "github_urls": row["github_urls"] if isinstance(row["github_urls"], list) else json.loads(row["github_urls"] or "[]"),
            "attachment_count": row["attachment_count"] or 0,
            "primary_pdf": row["primary_pdf"],
            "pdf_label": row["pdf_label"],
        })
    return {
        "candidates": candidates,
        "updated_at": latest_update.isoformat() if latest_update and hasattr(latest_update, "isoformat") else (_utc_now() if candidates else None),
    }


def candidate_exists(org_id: str, slug: str) -> bool:
    row = fetch_one(
        "SELECT 1 FROM candidates WHERE organization_id = %s AND slug = %s",
        (org_id, slug),
    )
    return row is not None


def load_metadata(org_id: str, slug: str) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT metadata FROM candidates WHERE organization_id = %s AND slug = %s",
        (org_id, slug),
    )
    if not row:
        return None
    meta = row["metadata"]
    return meta if isinstance(meta, dict) else json.loads(meta or "{}")


def load_links(org_id: str, slug: str) -> dict[str, list[str]]:
    row = fetch_one(
        "SELECT links FROM candidates WHERE organization_id = %s AND slug = %s",
        (org_id, slug),
    )
    if not row:
        return {"all": [], "github": [], "linkedin": [], "portfolio_and_other": []}
    links = row["links"]
    if isinstance(links, str):
        links = json.loads(links)
    return links or {"all": [], "github": [], "linkedin": [], "portfolio_and_other": []}


def load_combined_email(org_id: str, slug: str) -> str:
    row = fetch_one(
        "SELECT email_text FROM candidates WHERE organization_id = %s AND slug = %s",
        (org_id, slug),
    )
    return (row or {}).get("email_text") or ""


def load_extracted_texts(org_id: str, slug: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT filename, content_text, metadata
        FROM candidate_files
        WHERE organization_id = %s AND candidate_slug = %s AND kind = 'extracted'
        ORDER BY filename
        """,
        (org_id, slug),
    )
    texts: list[dict[str, Any]] = []
    for row in rows:
        content = row.get("content_text") or ""
        texts.append({
            "filename": row["filename"],
            "chars": len(content),
            "preview": content[:500],
            "content": content,
        })
    return texts


def list_attachments(org_id: str, slug: str) -> list[dict[str, Any]]:
    meta = load_metadata(org_id, slug) or {}
    file_rows = fetch_all(
        """
        SELECT filename, storage_path, mime_type, size_bytes, metadata
        FROM candidate_files
        WHERE organization_id = %s AND candidate_slug = %s AND kind = 'attachment'
        """,
        (org_id, slug),
    )
    by_name = {r["filename"]: r for r in file_rows}
    result: list[dict[str, Any]] = []
    for att in meta.get("attachments", []):
        saved_as = att.get("saved_as", att.get("filename", ""))
        file_row = by_name.get(saved_as) or by_name.get(att.get("filename", ""))
        result.append({
            **att,
            "exists": file_row is not None,
            "path": file_row["storage_path"] if file_row else None,
        })
    if not result and file_rows:
        for fr in file_rows:
            md = fr.get("metadata") or {}
            if isinstance(md, str):
                md = json.loads(md)
            result.append({
                "filename": md.get("filename", fr["filename"]),
                "saved_as": fr["filename"],
                "mime_type": fr.get("mime_type") or "application/pdf",
                "size": fr.get("size_bytes") or 0,
                "exists": True,
                "path": fr["storage_path"],
            })
    return result


def get_candidate_full(org_id: str, slug: str) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT * FROM candidates WHERE organization_id = %s AND slug = %s",
        (org_id, slug),
    )
    if not row:
        return None
    github_urls = row["github_urls"]
    if isinstance(github_urls, str):
        github_urls = json.loads(github_urls)
    received = row["received_at"]
    return {
        "slug": row["slug"],
        "email": row["email"] or "",
        "name": row["name"] or "",
        "subject": row["subject"] or "",
        "received_at": received.isoformat() if hasattr(received, "isoformat") else (str(received) if received else ""),
        "github_urls": github_urls or [],
        "attachment_count": row["attachment_count"] or 0,
        "primary_pdf": row["primary_pdf"],
        "pdf_label": row["pdf_label"],
        "metadata": load_metadata(org_id, slug) or {},
        "links": load_links(org_id, slug),
        "email_text": row["email_text"] or "",
        "extracted": load_extracted_texts(org_id, slug),
        "attachments": list_attachments(org_id, slug),
    }


def get_combined_text_for_scoring(org_id: str, slug: str) -> str:
    parts: list[str] = []
    email = load_combined_email(org_id, slug)
    if email:
        parts.append(email)
    for item in load_extracted_texts(org_id, slug):
        parts.append(item["content"])
    meta = load_metadata(org_id, slug) or {}
    if meta.get("subject"):
        parts.append(meta["subject"])
    if meta.get("from_name"):
        parts.append(meta["from_name"])
    links = load_links(org_id, slug)
    parts.extend(links.get("all", []))
    return "\n".join(parts).lower()


def get_attachment_bytes(org_id: str, slug: str, filename: str) -> tuple[bytes, str] | None:
    row = fetch_one(
        """
        SELECT storage_path, mime_type FROM candidate_files
        WHERE organization_id = %s AND candidate_slug = %s
          AND kind = 'attachment' AND filename = %s
        """,
        (org_id, slug, filename),
    )
    if not row or not row.get("storage_path"):
        return None
    data = download_bytes(row["storage_path"])
    mime = row.get("mime_type") or "application/octet-stream"
    return data, mime


def upsert_candidate(org_id: str, entry: dict[str, Any]) -> None:
    slug = entry["slug"]
    github_urls = entry.get("github_urls", [])
    metadata = entry.get("metadata", {})
    links = entry.get("links", {})
    received_at = entry.get("received_at") or None
    execute(
        """
        INSERT INTO candidates (
            organization_id, slug, email, name, subject, received_at,
            github_urls, attachment_count, primary_pdf, pdf_label,
            metadata, links, email_text, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s::jsonb, %s, %s, %s,
            %s::jsonb, %s::jsonb, %s, %s
        )
        ON CONFLICT (organization_id, slug) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            subject = EXCLUDED.subject,
            received_at = EXCLUDED.received_at,
            github_urls = EXCLUDED.github_urls,
            attachment_count = EXCLUDED.attachment_count,
            primary_pdf = EXCLUDED.primary_pdf,
            pdf_label = EXCLUDED.pdf_label,
            metadata = EXCLUDED.metadata,
            links = EXCLUDED.links,
            email_text = EXCLUDED.email_text,
            updated_at = EXCLUDED.updated_at
        """,
        (
            org_id, slug,
            entry.get("email", ""), entry.get("name", ""), entry.get("subject", ""),
            received_at,
            json.dumps(github_urls),
            entry.get("attachment_count", 0),
            entry.get("primary_pdf"), entry.get("pdf_label"),
            json.dumps(metadata), json.dumps(links),
            entry.get("email_text", ""),
            _utc_now(),
        ),
    )


def save_attachment(
    org_id: str,
    slug: str,
    filename: str,
    data: bytes,
    *,
    mime_type: str = "application/pdf",
    metadata: dict | None = None,
) -> str:
    path = storage_path(org_id, slug, "attachments", filename)
    upload_bytes(path, data, mime_type)
    execute(
        """
        DELETE FROM candidate_files
        WHERE organization_id = %s AND candidate_slug = %s AND kind = 'attachment' AND filename = %s
        """,
        (org_id, slug, filename),
    )
    execute(
        """
        INSERT INTO candidate_files (
            organization_id, candidate_slug, kind, filename,
            storage_path, mime_type, size_bytes, metadata
        ) VALUES (%s, %s, 'attachment', %s, %s, %s, %s, %s::jsonb)
        """,
        (org_id, slug, filename, path, mime_type, len(data), json.dumps(metadata or {})),
    )
    return path


def save_extracted_text(
    org_id: str,
    slug: str,
    filename: str,
    content: str,
) -> None:
    execute(
        """
        INSERT INTO candidate_files (
            organization_id, candidate_slug, kind, filename, content_text
        ) VALUES (%s, %s, 'extracted', %s, %s)
        ON CONFLICT DO NOTHING
        """,
        (org_id, slug, filename, content),
    )


def get_sync_state(org_id: str) -> dict[str, Any]:
    row = fetch_one(
        "SELECT processed_message_ids, last_run_at FROM sync_state WHERE organization_id = %s",
        (org_id,),
    )
    if not row:
        return {"processed_message_ids": [], "last_run_at": None}
    ids = row["processed_message_ids"]
    if isinstance(ids, str):
        ids = json.loads(ids)
    last = row["last_run_at"]
    return {
        "processed_message_ids": ids or [],
        "last_run_at": last.isoformat() if last and hasattr(last, "isoformat") else last,
    }


def save_sync_state(org_id: str, state: dict[str, Any]) -> None:
    execute(
        """
        INSERT INTO sync_state (organization_id, processed_message_ids, last_run_at)
        VALUES (%s, %s::jsonb, %s)
        ON CONFLICT (organization_id) DO UPDATE SET
            processed_message_ids = EXCLUDED.processed_message_ids,
            last_run_at = EXCLUDED.last_run_at
        """,
        (
            org_id,
            json.dumps(state.get("processed_message_ids", [])),
            state.get("last_run_at") or _utc_now(),
        ),
    )
