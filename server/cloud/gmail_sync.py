"""Cloud Gmail sync — fetch applicants into Postgres + Storage."""

from __future__ import annotations

import os
import re
import threading
from datetime import datetime, timezone
from typing import Any

from googleapiclient.errors import HttpError

from server.cloud import candidates_repo as candidates
from server.cloud.gmail_oauth import get_gmail_service_for_user
from server.stores import workflow as workflow_store
from server.stores.context import get_current_context

# Reuse parsing utilities from CLI script
from scripts.fetch_emails import (  # noqa: E402
    build_query,
    download_attachment,
    extract_urls,
    list_message_ids,
    parse_message_payload,
    safe_filename,
    slugify_email,
)


def _save_candidate_cloud(
    org_id: str,
    service,
    msg: dict[str, Any],
    *,
    force: bool = False,
) -> str | None:
    message_id = msg["id"]
    headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}
    from_header = headers.get("from", "unknown")
    subject = headers.get("subject", "(no subject)")
    date_header = headers.get("date")

    received_at = None
    if date_header:
        try:
            from email.utils import parsedate_to_datetime
            received_at = parsedate_to_datetime(date_header).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            received_at = date_header

    from_email = from_header
    from_name = ""
    match = re.match(r"^(?:(.+?)\s*)?<([^>]+)>$", from_header)
    if match:
        from_name = (match.group(1) or "").strip().strip('"')
        from_email = match.group(2).strip()

    slug = slugify_email(from_email)
    existing_meta = candidates.load_metadata(org_id, slug) or {}
    processed_ids = set(existing_meta.get("message_ids", []))
    if message_id in processed_ids and not force:
        return None

    plain, _html, attachment_meta = parse_message_payload(msg["payload"])
    links = extract_urls(plain, subject)

    saved_attachments: list[dict[str, Any]] = list(existing_meta.get("attachments", []))
    for att in attachment_meta:
        filename = safe_filename(att["filename"])
        saved_as = f"{message_id}_{filename}"
        if not force and any(a.get("saved_as") == saved_as for a in saved_attachments):
            continue
        content = download_attachment(service, message_id, att["attachment_id"])
        candidates.save_attachment(
            org_id, slug, saved_as, content,
            mime_type=att.get("mime_type") or "application/pdf",
            metadata={"filename": filename, "message_id": message_id},
        )
        saved_attachments.append({
            "filename": filename,
            "saved_as": saved_as,
            "mime_type": att.get("mime_type"),
            "size": att.get("size", len(content)),
            "message_id": message_id,
        })

    all_links = existing_meta.get("links", {"all": [], "github": [], "linkedin": [], "portfolio_and_other": []})
    for key in all_links:
        all_links[key] = sorted(set(all_links.get(key, []) + links.get(key, [])))

    message_ids = sorted(set(existing_meta.get("message_ids", []) + [message_id]))
    existing_email = candidates.load_combined_email(org_id, slug)
    email_block = f"From: {from_header}\nSubject: {subject}\nDate: {date_header or ''}\n\n{plain}"
    if existing_email:
        combined = existing_email + "\n\n--- EMAIL THREAD SEPARATOR ---\n\n" + email_block
    else:
        combined = email_block

    metadata = {
        "slug": slug,
        "from_email": from_email,
        "from_name": from_name or existing_meta.get("from_name", ""),
        "subject": subject,
        "received_at": received_at or existing_meta.get("received_at"),
        "message_ids": message_ids,
        "gmail_thread_id": msg.get("threadId") or existing_meta.get("gmail_thread_id"),
        "links": all_links,
        "attachments": saved_attachments,
        "attachment_count": len(saved_attachments),
    }

    primary_pdf = None
    pdf_label = None
    for att in saved_attachments:
        if att.get("filename", "").lower().endswith(".pdf") or "pdf" in (att.get("mime_type") or ""):
            primary_pdf = att.get("saved_as")
            pdf_label = att.get("filename")
            break

    candidates.upsert_candidate(org_id, {
        "slug": slug,
        "email": from_email,
        "name": from_name,
        "subject": subject,
        "received_at": received_at,
        "github_urls": all_links.get("github", []),
        "attachment_count": len(saved_attachments),
        "primary_pdf": primary_pdf,
        "pdf_label": pdf_label,
        "metadata": metadata,
        "links": all_links,
        "email_text": combined,
    })
    return slug


def run_fetch_emails(*, only_new: bool = True, force: bool = False) -> None:
    ctx = get_current_context()
    org_id = ctx.require_org()
    user_id = ctx.user_id or ""
    job_id = workflow_store.create_sync_job("fetch_emails")

    def _task() -> None:
        try:
            service = get_gmail_service_for_user(org_id, user_id)
            state = candidates.get_sync_state(org_id)
            processed: set[str] = set(state.get("processed_message_ids", []))
            query = build_query(
                os.getenv("GMAIL_QUERY", ""),
                os.getenv("GMAIL_AFTER_DATE") or None,
                only_new,
                state,
            )
            max_results = int(os.getenv("GMAIL_MAX_RESULTS", "500"))
            message_ids = list_message_ids(service, query, max_results)
            new_count = 0
            for mid in message_ids:
                if mid in processed and not force:
                    continue
                msg = service.users().messages().get(userId="me", id=mid, format="full").execute()
                if _save_candidate_cloud(org_id, service, msg, force=force):
                    new_count += 1
                    processed.add(mid)
            state["processed_message_ids"] = sorted(processed)
            state["last_run_at"] = datetime.now(timezone.utc).isoformat()
            candidates.save_sync_state(org_id, state)
            workflow_store.finish_sync_job(
                job_id, "success",
                f"Fetched {new_count} new/updated candidates (query: {query})",
            )
        except HttpError as exc:
            workflow_store.finish_sync_job(job_id, "error", f"Gmail API error: {exc}")
        except Exception as exc:  # noqa: BLE001
            workflow_store.finish_sync_job(job_id, "error", str(exc))

    threading.Thread(target=_task, daemon=True).start()


def run_extract_resumes(*, slug: str | None = None) -> None:
    org_id = get_current_context().require_org()
    job_id = workflow_store.create_sync_job("extract_resumes")

    def _task() -> None:
        try:
            from server.cloud.extract_service import extract_all_for_org
            count = extract_all_for_org(org_id, slug=slug)
            workflow_store.finish_sync_job(job_id, "success", f"Extracted text from {count} PDF(s)")
        except Exception as exc:  # noqa: BLE001
            workflow_store.finish_sync_job(job_id, "error", str(exc))

    threading.Thread(target=_task, daemon=True).start()


def run_full_sync(*, only_new: bool = True) -> None:
    ctx = get_current_context()
    org_id = ctx.require_org()
    user_id = ctx.user_id or ""
    job_id = workflow_store.create_sync_job("full_sync")

    def _task() -> None:
        try:
            service = get_gmail_service_for_user(org_id, user_id)
            state = candidates.get_sync_state(org_id)
            processed: set[str] = set(state.get("processed_message_ids", []))
            query = build_query(
                os.getenv("GMAIL_QUERY", ""),
                os.getenv("GMAIL_AFTER_DATE") or None,
                only_new,
                state,
            )
            message_ids = list_message_ids(service, query, int(os.getenv("GMAIL_MAX_RESULTS", "500")))
            new_count = 0
            for mid in message_ids:
                if mid in processed:
                    continue
                msg = service.users().messages().get(userId="me", id=mid, format="full").execute()
                if _save_candidate_cloud(org_id, service, msg):
                    new_count += 1
                    processed.add(mid)
            state["processed_message_ids"] = sorted(processed)
            state["last_run_at"] = datetime.now(timezone.utc).isoformat()
            candidates.save_sync_state(org_id, state)
            from server.cloud.extract_service import extract_all_for_org
            extract_count = extract_all_for_org(org_id)
            workflow_store.finish_sync_job(
                job_id, "success",
                f"Fetch: {new_count} candidates. Extract: {extract_count} PDFs.",
            )
        except Exception as exc:  # noqa: BLE001
            workflow_store.finish_sync_job(job_id, "error", str(exc))

    threading.Thread(target=_task, daemon=True).start()
