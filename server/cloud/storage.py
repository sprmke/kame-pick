"""Supabase Storage helpers for candidate files."""

from __future__ import annotations

import httpx

from server.cloud.config import get_supabase_service_key, get_supabase_url


def storage_path(org_id: str, slug: str, folder: str, filename: str) -> str:
    return f"{org_id}/{slug}/{folder}/{filename}"


def _headers() -> dict[str, str]:
    key = get_supabase_service_key()
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for storage operations")
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }


def upload_bytes(path: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    url = get_supabase_url()
    if not url:
        raise RuntimeError("SUPABASE_URL is required for storage operations")
    endpoint = f"{url.rstrip('/')}/storage/v1/object/candidate-files/{path}"
    resp = httpx.post(
        endpoint,
        content=data,
        headers={**_headers(), "Content-Type": content_type, "x-upsert": "true"},
        timeout=120.0,
    )
    resp.raise_for_status()


def download_bytes(path: str) -> bytes:
    url = get_supabase_url()
    if not url:
        raise RuntimeError("SUPABASE_URL is required for storage operations")
    endpoint = f"{url.rstrip('/')}/storage/v1/object/candidate-files/{path}"
    resp = httpx.get(endpoint, headers=_headers(), timeout=120.0)
    resp.raise_for_status()
    return resp.content


def get_signed_url(path: str, expires_in: int = 3600) -> str:
    url = get_supabase_url()
    if not url:
        raise RuntimeError("SUPABASE_URL is required for storage operations")
    endpoint = f"{url.rstrip('/')}/storage/v1/object/sign/candidate-files/{path}"
    resp = httpx.post(
        endpoint,
        json={"expiresIn": expires_in},
        headers={**_headers(), "Content-Type": "application/json"},
        timeout=30.0,
    )
    resp.raise_for_status()
    data = resp.json()
    signed = data.get("signedURL") or data.get("signedUrl") or ""
    if signed.startswith("/"):
        return f"{url.rstrip('/')}{signed}"
    return signed
