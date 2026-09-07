"""Gmail candidate email fetcher — incremental, idempotent sync."""

from __future__ import annotations

import argparse
import base64
import email
import json
import os
import re
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from googleapiclient.errors import HttpError

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent
sys.path.insert(0, str(ROOT))

from server.services.gmail_client import get_gmail_service  # noqa: E402
DATA_DIR = REPO_ROOT / "data"
CANDIDATES_DIR = DATA_DIR / "candidates"
SYNC_STATE_PATH = DATA_DIR / ".sync-state.json"

URL_PATTERN = re.compile(
    r"https?://[^\s<>\"')\]]+",
    re.IGNORECASE,
)

GITHUB_PATTERN = re.compile(
    r"https?://(?:www\.)?github\.com/[A-Za-z0-9_-]+/?(?:\?[^\s<>\"')\]]*)?",
    re.IGNORECASE,
)

LINKEDIN_PATTERN = re.compile(
    r"https?://(?:[\w-]+\.)?linkedin\.com/[^\s<>\"')\]]+",
    re.IGNORECASE,
)


def slugify_email(value: str) -> str:
    cleaned = value.strip().lower()
    cleaned = re.sub(r"[^a-z0-9@._-]+", "-", cleaned)
    return cleaned.replace("@", "-at-")


def load_sync_state() -> dict[str, Any]:
    if SYNC_STATE_PATH.exists():
        return json.loads(SYNC_STATE_PATH.read_text(encoding="utf-8"))
    return {"processed_message_ids": [], "last_run_at": None}


def save_sync_state(state: dict[str, Any]) -> None:
    SYNC_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SYNC_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def decode_part_data(data: str) -> str:
    raw = base64.urlsafe_b64decode(data)
    return raw.decode("utf-8", errors="replace")


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return soup.get_text("\n", strip=True)


def extract_urls(*texts: str) -> dict[str, list[str]]:
    all_urls: set[str] = set()
    github: set[str] = set()
    linkedin: set[str] = set()
    other: set[str] = set()

    for text in texts:
        if not text:
            continue
        for match in URL_PATTERN.findall(text):
            url = match.rstrip(".,);]")
            all_urls.add(url)
            if "github.com" in url.lower():
                github.add(url)
            elif "linkedin.com" in url.lower():
                linkedin.add(url)
            else:
                other.add(url)

    return {
        "all": sorted(all_urls),
        "github": sorted(github),
        "linkedin": sorted(linkedin),
        "portfolio_and_other": sorted(other),
    }


def walk_parts(part: dict[str, Any], texts: list[str], htmls: list[str], attachments: list[dict]) -> None:
    mime = part.get("mimeType", "")
    body = part.get("body", {})
    filename = part.get("filename") or ""

    if part.get("parts"):
        for child in part["parts"]:
            walk_parts(child, texts, htmls, attachments)
        return

    if filename and body.get("attachmentId"):
        attachments.append(
            {
                "filename": filename,
                "mime_type": mime,
                "attachment_id": body["attachmentId"],
                "size": body.get("size", 0),
            }
        )
        return

    data = body.get("data")
    if not data:
        return

    decoded = decode_part_data(data)
    if mime == "text/plain":
        texts.append(decoded)
    elif mime == "text/html":
        htmls.append(decoded)


def parse_message_payload(payload: dict[str, Any]) -> tuple[str, str, list[dict]]:
    texts: list[str] = []
    htmls: list[str] = []
    attachments: list[dict] = []
    walk_parts(payload, texts, htmls, attachments)

    plain = "\n\n".join(texts).strip()
    html = "\n\n".join(htmls).strip()
    if not plain and html:
        plain = html_to_text(html)

    return plain, html, attachments


def download_attachment(service, message_id: str, attachment_id: str) -> bytes:
    result = (
        service.users()
        .messages()
        .attachments()
        .get(userId="me", messageId=message_id, id=attachment_id)
        .execute()
    )
    return base64.urlsafe_b64decode(result["data"])


def safe_filename(name: str) -> str:
    name = name.strip() or "attachment"
    return re.sub(r"[^\w.\- ]+", "_", name)


def update_manifest(candidate_dir: Path, metadata: dict[str, Any]) -> None:
    manifest_path = CANDIDATES_DIR / "manifest.json"
    manifest: dict[str, Any] = {"candidates": [], "updated_at": datetime.now(timezone.utc).isoformat()}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    slug = candidate_dir.name
    entry = {
        "slug": slug,
        "email": metadata.get("from_email"),
        "name": metadata.get("from_name"),
        "subject": metadata.get("subject"),
        "received_at": metadata.get("received_at"),
        "message_ids": metadata.get("message_ids", []),
        "path": str(candidate_dir.relative_to(ROOT)),
        "github_urls": metadata.get("links", {}).get("github", []),
        "attachment_count": metadata.get("attachment_count", 0),
    }

    existing = next((i for i, c in enumerate(manifest["candidates"]) if c["slug"] == slug), None)
    if existing is not None:
        old = manifest["candidates"][existing]
        merged_ids = sorted(set(old.get("message_ids", []) + entry["message_ids"]))
        entry["message_ids"] = merged_ids
        manifest["candidates"][existing] = {**old, **entry}
    else:
        manifest["candidates"].append(entry)

    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def save_candidate(
    service,
    msg: dict[str, Any],
    *,
    force: bool = False,
) -> Path | None:
    message_id = msg["id"]
    headers = {h["name"].lower(): h["value"] for h in msg["payload"].get("headers", [])}
    from_header = headers.get("from", "unknown")
    subject = headers.get("subject", "(no subject)")
    date_header = headers.get("date")

    received_at = None
    if date_header:
        try:
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
    candidate_dir = CANDIDATES_DIR / slug
    candidate_dir.mkdir(parents=True, exist_ok=True)
    attachments_dir = candidate_dir / "attachments"
    attachments_dir.mkdir(exist_ok=True)

    metadata_path = candidate_dir / "metadata.json"
    existing_meta: dict[str, Any] = {}
    if metadata_path.exists():
        existing_meta = json.loads(metadata_path.read_text(encoding="utf-8"))

    processed_ids = set(existing_meta.get("message_ids", []))
    if message_id in processed_ids and not force:
        return None

    plain, html, attachment_meta = parse_message_payload(msg["payload"])
    links = extract_urls(plain, html, subject)

    email_txt_path = candidate_dir / "emails" / f"{message_id}.txt"
    email_txt_path.parent.mkdir(parents=True, exist_ok=True)
    email_txt_path.write_text(
        f"From: {from_header}\nSubject: {subject}\nDate: {date_header or ''}\n\n{plain}",
        encoding="utf-8",
    )

    if html:
        html_path = candidate_dir / "emails" / f"{message_id}.html"
        html_path.write_text(html, encoding="utf-8")

    saved_attachments: list[dict[str, Any]] = list(existing_meta.get("attachments", []))
    for att in attachment_meta:
        filename = safe_filename(att["filename"])
        dest = attachments_dir / f"{message_id}_{filename}"
        if dest.exists() and not force:
            continue
        content = download_attachment(service, message_id, att["attachment_id"])
        dest.write_bytes(content)
        saved_attachments.append(
            {
                "filename": filename,
                "saved_as": dest.name,
                "mime_type": att["mime_type"],
                "size": att["size"],
                "message_id": message_id,
            }
        )

    all_links = existing_meta.get("links", {"all": [], "github": [], "linkedin": [], "portfolio_and_other": []})
    for key in all_links:
        all_links[key] = sorted(set(all_links.get(key, []) + links.get(key, [])))

    message_ids = sorted(set(existing_meta.get("message_ids", []) + [message_id]))
    gmail_thread_id = msg.get("threadId") or existing_meta.get("gmail_thread_id")

    metadata = {
        "slug": slug,
        "from_email": from_email,
        "from_name": from_name or existing_meta.get("from_name", ""),
        "subject": subject,
        "received_at": received_at or existing_meta.get("received_at"),
        "latest_message_at": received_at,
        "message_ids": message_ids,
        "gmail_thread_id": gmail_thread_id,
        "links": all_links,
        "attachments": saved_attachments,
        "attachment_count": len(saved_attachments),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    combined_path = candidate_dir / "combined-email.txt"
    email_files = sorted((candidate_dir / "emails").glob("*.txt"))
    combined_path.write_text(
        "\n\n--- EMAIL THREAD SEPARATOR ---\n\n".join(f.read_text(encoding="utf-8") for f in email_files),
        encoding="utf-8",
    )

    links_path = candidate_dir / "links.json"
    links_path.write_text(json.dumps(all_links, indent=2), encoding="utf-8")

    update_manifest(candidate_dir, metadata)
    return candidate_dir


def list_message_ids(service, query: str, max_results: int) -> list[str]:
    ids: list[str] = []
    page_token = None
    while len(ids) < max_results:
        batch_size = min(100, max_results - len(ids))
        response = (
            service.users()
            .messages()
            .list(userId="me", q=query, maxResults=batch_size, pageToken=page_token)
            .execute()
        )
        for item in response.get("messages", []):
            ids.append(item["id"])
        page_token = response.get("nextPageToken")
        if not page_token:
            break
    return ids


def build_query(base_query: str, after_date: str | None, only_new: bool, state: dict[str, Any]) -> str:
    parts = [base_query.strip()] if base_query.strip() else []
    if after_date:
        parts.append(f"after:{after_date}")
    if only_new and state.get("last_run_at"):
        # Gmail after: uses date only; combine with processed ID skip in code
        dt = datetime.fromisoformat(state["last_run_at"].replace("Z", "+00:00"))
        parts.append(f"after:{dt.strftime('%Y/%m/%d')}")
    return " ".join(parts)


def main() -> None:
    load_dotenv(ROOT / ".env")

    parser = argparse.ArgumentParser(description="Fetch job applicant emails from Gmail")
    parser.add_argument("--force", action="store_true", help="Re-download already processed messages")
    parser.add_argument("--only-new", action="store_true", help="Only fetch since last successful run")
    parser.add_argument("--query", default=os.getenv("GMAIL_QUERY", ""), help="Gmail search query")
    parser.add_argument("--after", default=os.getenv("GMAIL_AFTER_DATE", ""), help="Gmail after: date YYYY/MM/DD")
    parser.add_argument(
        "--max",
        type=int,
        default=int(os.getenv("GMAIL_MAX_RESULTS", "500")),
        help="Max messages per run",
    )
    parser.add_argument(
        "--credentials",
        type=Path,
        default=ROOT / "credentials.json",
        help="Path to OAuth client credentials JSON",
    )
    parser.add_argument(
        "--token",
        type=Path,
        default=ROOT / "token.json",
        help="Path to store OAuth token",
    )
    args = parser.parse_args()

    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    state = load_sync_state()
    processed: set[str] = set(state.get("processed_message_ids", []))

    query = build_query(args.query, args.after or None, args.only_new, state)
    print(f"Gmail query: {query}")

    try:
        service = get_gmail_service(args.credentials, args.token)
        message_ids = list_message_ids(service, query, args.max)
    except HttpError as exc:
        print(f"Gmail API error: {exc}", file=sys.stderr)
        sys.exit(1)

    if not message_ids:
        print("No messages matched.")
        return

    new_count = 0
    skipped = 0
    for mid in message_ids:
        if mid in processed and not args.force:
            skipped += 1
            continue
        msg = service.users().messages().get(userId="me", id=mid, format="full").execute()
        saved = save_candidate(service, msg, force=args.force)
        if saved:
            print(f"Saved: {saved.name}")
            new_count += 1
            processed.add(mid)
        else:
            skipped += 1

    state["processed_message_ids"] = sorted(processed)
    state["last_run_at"] = datetime.now(timezone.utc).isoformat()
    state["last_query"] = query
    save_sync_state(state)

    print(f"\nDone. New/updated: {new_count}, skipped: {skipped}, total tracked: {len(processed)}")
    print(f"Candidates folder: {CANDIDATES_DIR}")
    print(f"Manifest: {CANDIDATES_DIR / 'manifest.json'}")


if __name__ == "__main__":
    main()
