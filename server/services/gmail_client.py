"""Shared Gmail OAuth and API helpers."""

from __future__ import annotations

import base64
import re
from email.mime.text import MIMEText
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from server.config import ROOT

# Read + send; user must re-authorize after upgrading from readonly-only token.
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
]

DEFAULT_CREDENTIALS = ROOT / "credentials.json"
DEFAULT_TOKEN = ROOT / "token.json"


class GmailNotConfiguredError(RuntimeError):
    pass


def get_gmail_service(
    credentials_path: Path | None = None,
    token_path: Path | None = None,
):
    credentials_path = credentials_path or DEFAULT_CREDENTIALS
    token_path = token_path or DEFAULT_TOKEN

    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not credentials_path.exists():
                raise GmailNotConfiguredError(
                    "Missing credentials.json — see README for Gmail OAuth setup."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json(), encoding="utf-8")

    return build("gmail", "v1", credentials=creds)


def get_sender_email(service) -> str:
    profile = service.users().getProfile(userId="me").execute()
    return profile.get("emailAddress", "")


def get_message_metadata(service, message_id: str) -> dict[str, str | None]:
    try:
        msg = (
            service.users()
            .messages()
            .get(userId="me", id=message_id, format="metadata", metadataHeaders=["Message-ID", "Subject"])
            .execute()
        )
        headers = {h["name"].lower(): h["value"] for h in msg.get("payload", {}).get("headers", [])}
        return {
            "thread_id": msg.get("threadId"),
            "message_id_header": headers.get("message-id"),
            "subject": headers.get("subject"),
        }
    except Exception:  # noqa: BLE001
        return {"thread_id": None, "message_id_header": None, "subject": None}


def get_message_thread_id(service, message_id: str) -> str | None:
    return get_message_metadata(service, message_id).get("thread_id")


def find_thread_id_for_candidate(service, candidate_email: str) -> str | None:
    try:
        result = (
            service.users()
            .messages()
            .list(userId="me", q=f"from:{candidate_email}", maxResults=1)
            .execute()
        )
        messages = result.get("messages", [])
        if not messages:
            result = (
                service.users()
                .messages()
                .list(userId="me", q=f"to:{candidate_email}", maxResults=1)
                .execute()
            )
            messages = result.get("messages", [])
        if not messages:
            return None
        return get_message_thread_id(service, messages[0]["id"])
    except Exception:  # noqa: BLE001
        return None


def build_raw_message(
    *,
    to_email: str,
    subject: str,
    body_text: str,
    from_email: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> str:
    message = MIMEText(body_text, "plain", "utf-8")
    message["To"] = to_email
    message["Subject"] = subject
    if from_email:
        message["From"] = from_email
    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
    if references:
        message["References"] = references
    return base64.urlsafe_b64encode(message.as_bytes()).decode()


def send_email(
    service,
    *,
    to_email: str,
    subject: str,
    body_text: str,
    thread_id: str | None = None,
    in_reply_to: str | None = None,
    references: str | None = None,
) -> dict[str, Any]:
    from_email = get_sender_email(service)
    raw = build_raw_message(
        to_email=to_email,
        subject=subject,
        body_text=body_text,
        from_email=from_email,
        in_reply_to=in_reply_to,
        references=references,
    )
    payload: dict[str, Any] = {"raw": raw}
    if thread_id:
        payload["threadId"] = thread_id

    sent = service.users().messages().send(userId="me", body=payload).execute()
    return {
        "gmail_message_id": sent.get("id"),
        "gmail_thread_id": sent.get("threadId") or thread_id,
        "from_email": from_email,
    }


def normalize_subject_for_reply(subject: str) -> str:
    subject = subject.strip() or "(no subject)"
    if not re.match(r"^re:\s", subject, re.I):
        return f"Re: {subject}"
    return subject
