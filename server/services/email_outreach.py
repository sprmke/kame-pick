"""Send and list candidate email conversations."""

from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

from server.config import JOB_CRITERIA_PATH, ROOT
from server.db import (
    insert_email_message,
    list_email_messages,
    list_emails_for_run,
    slugs_with_sent_outbound,
    upsert_candidate_note,
)
from server.env import load_project_env
from server.services.candidates import candidate_dir, get_candidate_full, load_metadata
from server.services.gmail_client import (
    GmailNotConfiguredError,
    find_thread_id_for_candidate,
    get_gmail_service,
    get_message_metadata,
    get_message_thread_id,
    normalize_subject_for_reply,
    send_email,
)

PLACEHOLDER_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

SHORTLIST_TEMPLATE_PATH = ROOT / "config" / "shortlist-email-template.txt"

load_project_env()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _message_timestamp(message: dict[str, Any]) -> float:
    """Normalize sent_at values for stable chronological sorting."""
    raw = message.get("sent_at") or message.get("created_at")
    if raw is None or raw == "":
        return 0.0
    if isinstance(raw, (int, float)):
        return float(raw)

    text = str(raw).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(text).timestamp()
    except (TypeError, ValueError, OverflowError):
        pass
    try:
        return float(text)
    except ValueError:
        return 0.0


def render_template(text: str, context: dict[str, str]) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1).lower()
        return context.get(key, match.group(0))

    return PLACEHOLDER_RE.sub(repl, text)


def _load_role_title() -> str:
    try:
        import yaml

        if JOB_CRITERIA_PATH.exists():
            data = yaml.safe_load(JOB_CRITERIA_PATH.read_text(encoding="utf-8"))
            return str(data.get("role") or "AI-Assisted Web Developer")
    except Exception:  # noqa: BLE001
        pass
    return "AI-Assisted Web Developer"


def base_email_context() -> dict[str, str]:
    return {
        "team_name": os.getenv("RECRUITER_TEAM_NAME", "").strip() or "Hiring Team",
        "role": _load_role_title(),
    }


def candidate_email_context(slug: str) -> dict[str, str]:
    data = get_candidate_full(slug) or {}
    meta = data.get("metadata") or {}
    name = data.get("name") or meta.get("from_name") or slug
    email = data.get("email") or meta.get("from_email") or ""
    return {
        **base_email_context(),
        "name": name,
        "email": email,
        "slug": slug,
        "first_name": name.split()[0] if name else slug,
    }


def get_default_email_template() -> dict[str, str]:
    if SHORTLIST_TEMPLATE_PATH.exists():
        body = SHORTLIST_TEMPLATE_PATH.read_text(encoding="utf-8").strip()
    else:
        body = (
            "Hi {{first_name}},\n\n"
            "Thank you for applying. We would like to move forward.\n\n"
            "Best regards,\n{{team_name}}"
        )
    ctx = base_email_context()
    return {
        "body": body,
        "placeholders": ["first_name", "name", "email", "role", "team_name"],
        "team_name": ctx["team_name"],
        "role": ctx["role"],
    }


def _append_outbound_to_disk(
    slug: str,
    *,
    gmail_message_id: str,
    from_email: str,
    to_email: str,
    subject: str,
    body_text: str,
    sent_at: str,
) -> None:
    base = candidate_dir(slug)
    emails_dir = base / "emails"
    emails_dir.mkdir(parents=True, exist_ok=True)

    path = emails_dir / f"{gmail_message_id}.txt"
    path.write_text(
        f"From: {from_email}\nTo: {to_email}\nSubject: {subject}\nDate: {sent_at}\n\n{body_text}",
        encoding="utf-8",
    )

    combined_path = base / "combined-email.txt"
    email_files = sorted(emails_dir.glob("*.txt"))
    combined_path.write_text(
        "\n\n--- EMAIL THREAD SEPARATOR ---\n\n".join(f.read_text(encoding="utf-8") for f in email_files),
        encoding="utf-8",
    )

    metadata_path = base / "metadata.json"
    meta: dict[str, Any] = {}
    if metadata_path.exists():
        meta = json.loads(metadata_path.read_text(encoding="utf-8"))
    message_ids = sorted(set(meta.get("message_ids", []) + [gmail_message_id]))
    meta["message_ids"] = message_ids
    meta["gmail_thread_id"] = meta.get("gmail_thread_id")
    metadata_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")


def _load_inbound_from_disk(slug: str) -> list[dict[str, Any]]:
    emails_dir = candidate_dir(slug) / "emails"
    if not emails_dir.exists():
        return []

    meta = load_metadata(slug) or {}
    fallback_ts = _message_timestamp({"sent_at": meta.get("received_at")})

    outbound_ids = {
        m["gmail_message_id"]
        for m in list_email_messages(slug)
        if m.get("gmail_message_id") and m.get("direction") == "outbound"
    }

    ordered_ids = meta.get("message_ids") or []
    extra_ids = [
        p.stem
        for p in sorted(emails_dir.glob("*.txt"))
        if p.stem not in ordered_ids and p.stem not in outbound_ids
    ]
    file_order = ordered_ids + extra_ids

    inbound: list[dict[str, Any]] = []
    for message_id in file_order:
        path = emails_dir / f"{message_id}.txt"
        if not path.exists() or message_id in outbound_ids:
            continue
        text = path.read_text(encoding="utf-8")
        from_line = ""
        subject = "(no subject)"
        date = ""
        body = text
        if text.startswith("From:"):
            parts = text.split("\n\n", 1)
            header_block = parts[0]
            body = parts[1] if len(parts) > 1 else ""
            for line in header_block.splitlines():
                lower = line.lower()
                if lower.startswith("from:"):
                    from_line = line[5:].strip()
                elif lower.startswith("subject:"):
                    subject = line[8:].strip()
                elif lower.startswith("date:"):
                    date = line[5:].strip()

        inbound.append(
            {
                "id": f"inbound-{message_id}",
                "slug": slug,
                "analysis_run_id": None,
                "gmail_message_id": message_id,
                "gmail_thread_id": None,
                "direction": "inbound",
                "from_email": from_line,
                "to_email": "",
                "subject": subject,
                "body_text": body.strip(),
                "sent_at": date or meta.get("received_at") or "",
                "created_at": date,
                "sort_ts": _message_timestamp({"sent_at": date}) or fallback_ts or path.stat().st_mtime,
                "status": "received",
                "error": None,
                "source": "sync",
            }
        )
    return inbound


def get_email_thread(
    slug: str,
    *,
    analysis_run_id: int | None = None,
) -> dict[str, Any]:
    db_messages = list_email_messages(slug, analysis_run_id=analysis_run_id)
    if analysis_run_id is None:
        inbound = _load_inbound_from_disk(slug)
        combined = inbound + db_messages
    else:
        combined = db_messages

    for msg in combined:
        if "sort_ts" not in msg:
            msg["sort_ts"] = _message_timestamp(msg)

    combined.sort(key=lambda m: (m.get("sort_ts", 0), str(m.get("id", ""))))
    meta = load_metadata(slug) or {}
    has_outbound = any(m.get("direction") == "outbound" and m.get("status") == "sent" for m in combined)
    return {
        "slug": slug,
        "analysis_run_id": analysis_run_id,
        "candidate_email": meta.get("from_email") or "",
        "default_subject": normalize_subject_for_reply(meta.get("subject", "")),
        "gmail_thread_id": meta.get("gmail_thread_id"),
        "has_outbound": has_outbound,
        "messages": combined,
    }


def get_run_email_activity(analysis_run_id: int) -> dict[str, Any]:
    messages = list_emails_for_run(analysis_run_id)
    by_slug: dict[str, list[dict[str, Any]]] = {}
    for msg in messages:
        by_slug.setdefault(msg["slug"], []).append(msg)
    return {
        "analysis_run_id": analysis_run_id,
        "total_sent": sum(1 for m in messages if m["direction"] == "outbound" and m["status"] == "sent"),
        "messages": messages,
        "by_slug": by_slug,
    }


def _resolve_thread_id(service, slug: str, candidate_email: str) -> str | None:
    meta = load_metadata(slug) or {}
    if meta.get("gmail_thread_id"):
        return meta["gmail_thread_id"]
    message_ids = meta.get("message_ids") or []
    if message_ids:
        thread_id = get_message_thread_id(service, message_ids[-1])
        if thread_id:
            return thread_id
    return find_thread_id_for_candidate(service, candidate_email)


def preview_candidate_email(
    slug: str,
    *,
    subject: str,
    body: str,
    reply: bool = True,
) -> dict[str, Any]:
    ctx = candidate_email_context(slug)
    to_email = ctx.get("email", "").strip()
    if not to_email:
        raise ValueError("Candidate has no email address on file")

    subject_rendered = render_template(subject, ctx)
    body_rendered = render_template(body, ctx)
    meta = load_metadata(slug) or {}
    if reply and meta.get("subject"):
        subject_rendered = normalize_subject_for_reply(subject_rendered)

    return {
        "to_email": to_email,
        "to_name": ctx.get("name", ""),
        "subject": subject_rendered,
        "body": body_rendered,
    }


def send_candidate_email(
    slug: str,
    *,
    subject: str,
    body: str,
    analysis_run_id: int | None = None,
    reply: bool = True,
) -> dict[str, Any]:
    ctx = candidate_email_context(slug)
    to_email = ctx.get("email", "").strip()
    if not to_email:
        raise ValueError("Candidate has no email address on file")

    subject_rendered = render_template(subject, ctx)
    body_rendered = render_template(body, ctx)

    meta = load_metadata(slug) or {}
    if reply and meta.get("subject"):
        subject_rendered = normalize_subject_for_reply(subject_rendered)

    try:
        service = get_gmail_service()
    except GmailNotConfiguredError as exc:
        raise ValueError(str(exc)) from exc

    thread_id = _resolve_thread_id(service, slug, to_email) if reply else None
    in_reply_to = None
    references = None
    message_ids = meta.get("message_ids") or []
    if reply and message_ids:
        hdr = get_message_metadata(service, message_ids[-1])
        in_reply_to = hdr.get("message_id_header")
        references = in_reply_to
        if hdr.get("subject") and subject_rendered == normalize_subject_for_reply(meta.get("subject", "")):
            subject_rendered = normalize_subject_for_reply(hdr["subject"] or meta.get("subject", ""))

    try:
        result = send_email(
            service,
            to_email=to_email,
            subject=subject_rendered,
            body_text=body_rendered,
            thread_id=thread_id,
            in_reply_to=in_reply_to,
            references=references,
        )
        sent_at = _utc_now()
        gmail_message_id = result["gmail_message_id"]
        gmail_thread_id = result.get("gmail_thread_id")

        if gmail_message_id:
            _append_outbound_to_disk(
                slug,
                gmail_message_id=gmail_message_id,
                from_email=result["from_email"],
                to_email=to_email,
                subject=subject_rendered,
                body_text=body_rendered,
                sent_at=sent_at,
            )
            metadata_path = candidate_dir(slug) / "metadata.json"
            if metadata_path.exists():
                meta_data = json.loads(metadata_path.read_text(encoding="utf-8"))
                meta_data["gmail_thread_id"] = gmail_thread_id
                metadata_path.write_text(json.dumps(meta_data, indent=2), encoding="utf-8")

        record = insert_email_message(
            slug=slug,
            direction="outbound",
            from_email=result["from_email"],
            to_email=to_email,
            subject=subject_rendered,
            body_text=body_rendered,
            sent_at=sent_at,
            gmail_message_id=gmail_message_id,
            gmail_thread_id=gmail_thread_id,
            analysis_run_id=analysis_run_id,
            status="sent",
        )
        note = upsert_candidate_note(slug, status="shortlisted")
        return {"ok": True, "message": record, "note": note, "status_updated": True}
    except Exception as exc:  # noqa: BLE001
        record = insert_email_message(
            slug=slug,
            direction="outbound",
            from_email="",
            to_email=to_email,
            subject=subject_rendered,
            body_text=body_rendered,
            sent_at=_utc_now(),
            analysis_run_id=analysis_run_id,
            status="failed",
            error=str(exc),
        )
        return {"ok": False, "message": record, "error": str(exc)}


def send_batch_emails(
    slugs: list[str],
    *,
    subject: str,
    body: str,
    analysis_run_id: int | None = None,
    reply: bool = True,
    delay_seconds: float = 0.6,
) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    sent = 0
    failed = 0
    skipped = 0
    already_contacted = set(slugs_with_sent_outbound(slugs))

    for i, slug in enumerate(slugs):
        if slug in already_contacted:
            skipped += 1
            results.append(
                {
                    "slug": slug,
                    "ok": False,
                    "skipped": True,
                    "error": "Initial email already sent to this candidate",
                }
            )
            continue
        if i > 0:
            time.sleep(delay_seconds)
        try:
            outcome = send_candidate_email(
                slug,
                subject=subject,
                body=body,
                analysis_run_id=analysis_run_id,
                reply=reply,
            )
            if outcome.get("ok"):
                sent += 1
            else:
                failed += 1
            results.append({"slug": slug, **outcome})
        except Exception as exc:  # noqa: BLE001
            failed += 1
            results.append({"slug": slug, "ok": False, "error": str(exc)})

    return {
        "total": len(slugs),
        "sent": sent,
        "failed": failed,
        "skipped": skipped,
        "results": results,
    }


def gmail_send_ready() -> dict[str, Any]:
    try:
        service = get_gmail_service()
        from_email = service.users().getProfile(userId="me").execute().get("emailAddress", "")
        return {"ready": True, "from_email": from_email}
    except Exception as exc:  # noqa: BLE001
        return {"ready": False, "error": str(exc)}
