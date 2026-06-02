"""Gmail OAuth (web flow) and encrypted token storage."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet, InvalidToken
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from server.cloud.config import (
    get_encryption_key,
    get_google_oauth_client_id,
    get_google_oauth_client_secret,
    get_google_oauth_redirect_uri,
)
from server.cloud.pg import execute, fetch_one
from server.services.gmail_client import SCOPES, GmailNotConfiguredError

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _fernet() -> Fernet:
    key = get_encryption_key()
    if not key:
        raise RuntimeError("TOKEN_ENCRYPTION_KEY is required for Gmail OAuth in cloud mode")
    # Fernet needs 32 url-safe base64-encoded bytes
    if len(key) == 44 and key.endswith("="):
        return Fernet(key.encode())
    derived = base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest())
    return Fernet(derived)


def encrypt_credentials(creds_json: str) -> str:
    return _fernet().encrypt(creds_json.encode()).decode()


def decrypt_credentials(encrypted: str) -> str:
    try:
        return _fernet().decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise GmailNotConfiguredError("Invalid stored Gmail credentials") from exc


def oauth_configured() -> bool:
    return bool(
        get_google_oauth_client_id()
        and get_google_oauth_client_secret()
        and get_google_oauth_redirect_uri()
    )


def build_authorize_url(org_id: str, user_id: str) -> str:
    client_id = get_google_oauth_client_id()
    redirect_uri = get_google_oauth_redirect_uri()
    if not client_id or not redirect_uri:
        raise GmailNotConfiguredError("Google OAuth env vars not configured")
    state = secrets.token_urlsafe(32)
    execute(
        """
        INSERT INTO gmail_oauth_states (state, organization_id, user_id, created_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (state) DO NOTHING
        """,
        (state, org_id, user_id),
    )
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str, state: str) -> dict[str, Any]:
    row = fetch_one(
        "SELECT organization_id, user_id FROM gmail_oauth_states WHERE state = %s",
        (state,),
    )
    if not row:
        raise ValueError("Invalid OAuth state")
    execute("DELETE FROM gmail_oauth_states WHERE state = %s", (state,))

    client_id = get_google_oauth_client_id()
    client_secret = get_google_oauth_client_secret()
    redirect_uri = get_google_oauth_redirect_uri()
    resp = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    token_data = resp.json()

    creds = Credentials(
        token=token_data.get("access_token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=GOOGLE_TOKEN_URL,
        client_id=client_id,
        client_secret=client_secret,
        scopes=SCOPES,
    )
    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    email_address = profile.get("emailAddress", "")

    org_id = str(row["organization_id"])
    user_id = str(row["user_id"])
    encrypted = encrypt_credentials(creds.to_json())

    execute(
        """
        INSERT INTO gmail_connections (
            organization_id, user_id, email_address, credentials_encrypted, scopes
        ) VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
            email_address = EXCLUDED.email_address,
            credentials_encrypted = EXCLUDED.credentials_encrypted,
            scopes = EXCLUDED.scopes,
            updated_at = now()
        """,
        (org_id, user_id, email_address, encrypted, SCOPES),
    )
    return {"email_address": email_address, "organization_id": org_id}


def get_connection(org_id: str, user_id: str) -> dict[str, Any] | None:
    return fetch_one(
        """
        SELECT email_address, credentials_encrypted, connected_at, updated_at
        FROM gmail_connections
        WHERE organization_id = %s AND user_id = %s
        """,
        (org_id, user_id),
    )


def delete_connection(org_id: str, user_id: str) -> bool:
    from server.cloud.pg import get_conn

    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM gmail_connections WHERE organization_id = %s AND user_id = %s",
            (org_id, user_id),
        )
        return cur.rowcount > 0


def get_gmail_service_for_user(org_id: str, user_id: str):
    conn_row = get_connection(org_id, user_id)
    if not conn_row:
        raise GmailNotConfiguredError("Gmail not connected — connect in Settings")
    creds_json = decrypt_credentials(conn_row["credentials_encrypted"])
    creds = Credentials.from_authorized_user_info(json.loads(creds_json), SCOPES)
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            encrypted = encrypt_credentials(creds.to_json())
            execute(
                """
                UPDATE gmail_connections SET credentials_encrypted = %s, updated_at = now()
                WHERE organization_id = %s AND user_id = %s
                """,
                (encrypted, org_id, user_id),
            )
        else:
            raise GmailNotConfiguredError("Gmail token expired — reconnect in Settings")
    return build("gmail", "v1", credentials=creds)


def gmail_status(org_id: str, user_id: str) -> dict[str, Any]:
    if not oauth_configured():
        return {"ready": False, "error": "Google OAuth not configured on server"}
    conn = get_connection(org_id, user_id)
    if not conn:
        return {"ready": False, "error": "Gmail not connected", "connect_available": True}
    try:
        service = get_gmail_service_for_user(org_id, user_id)
        from server.services.gmail_client import get_sender_email
        email = get_sender_email(service)
        return {"ready": True, "from_email": email, "connected_at": str(conn.get("connected_at", ""))}
    except Exception as exc:  # noqa: BLE001
        return {"ready": False, "error": str(exc), "connect_available": True}
