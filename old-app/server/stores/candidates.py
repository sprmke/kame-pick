"""Unified candidate store — delegates to filesystem (local) or Postgres (cloud)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from server.cloud import candidates_repo as cloud_candidates
from server.config import CANDIDATES_DIR
from server.services import candidates as local_candidates
from server.stores.context import get_current_context


def load_manifest() -> dict[str, Any]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.load_manifest(ctx.require_org())
    return local_candidates.load_manifest()


def candidate_dir(slug: str) -> Path:
    return local_candidates.candidate_dir(slug)


def candidate_exists(slug: str) -> bool:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.candidate_exists(ctx.require_org(), slug)
    manifest = local_candidates.load_manifest()
    if any(c["slug"] == slug for c in manifest.get("candidates", [])):
        return True
    return (local_candidates.candidate_dir(slug) / "metadata.json").exists()


def load_metadata(slug: str) -> dict[str, Any] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.load_metadata(ctx.require_org(), slug)
    return local_candidates.load_metadata(slug)


def load_links(slug: str) -> dict[str, list[str]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.load_links(ctx.require_org(), slug)
    return local_candidates.load_links(slug)


def load_combined_email(slug: str) -> str:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.load_combined_email(ctx.require_org(), slug)
    return local_candidates.load_combined_email(slug)


def load_extracted_texts(slug: str) -> list[dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.load_extracted_texts(ctx.require_org(), slug)
    return local_candidates.load_extracted_texts(slug)


def list_attachments(slug: str) -> list[dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.list_attachments(ctx.require_org(), slug)
    return local_candidates.list_attachments(slug)


def get_candidate_full(slug: str) -> dict[str, Any] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.get_candidate_full(ctx.require_org(), slug)
    return local_candidates.get_candidate_full(slug)


def get_combined_text_for_scoring(slug: str) -> str:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.get_combined_text_for_scoring(ctx.require_org(), slug)
    return local_candidates.get_combined_text_for_scoring(slug)


def get_attachment_bytes(slug: str, filename: str) -> tuple[bytes, str] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_candidates.get_attachment_bytes(ctx.require_org(), slug, filename)
    path = local_candidates.candidate_dir(slug) / "attachments" / filename
    if not path.exists():
        return None
    mime = "application/pdf" if path.suffix.lower() == ".pdf" else "application/octet-stream"
    return path.read_bytes(), mime


def candidates_dir_exists() -> bool:
    ctx = get_current_context()
    if ctx.is_cloud:
        manifest = cloud_candidates.load_manifest(ctx.require_org())
        return len(manifest.get("candidates", [])) > 0
    return CANDIDATES_DIR.exists()
