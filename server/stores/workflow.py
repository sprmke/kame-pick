"""Unified workflow store — delegates to SQLite (local) or Postgres (cloud)."""

from __future__ import annotations

from typing import Any

from server import db as local_db
from server.cloud import workflow_repo as cloud_db
from server.stores.context import get_current_context


def get_candidate_note(slug: str) -> dict[str, Any] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.get_candidate_note(ctx.require_org(), slug)
    return local_db.get_candidate_note(slug)


def upsert_candidate_note(
    slug: str,
    *,
    status: str | None = None,
    starred: bool | None = None,
    notes: str | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.upsert_candidate_note(
            ctx.require_org(), slug,
            status=status, starred=starred, notes=notes, tags=tags,
        )
    return local_db.upsert_candidate_note(
        slug, status=status, starred=starred, notes=notes, tags=tags,
    )


def list_all_notes() -> dict[str, dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.list_all_notes(ctx.require_org())
    return local_db.list_all_notes()


def save_analysis_run(name: str, filter_json: dict, results: list) -> int:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.save_analysis_run(ctx.require_org(), name, filter_json, results)
    return local_db.save_analysis_run(name, filter_json, results)


def list_analysis_runs() -> list[dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.list_analysis_runs(ctx.require_org())
    return local_db.list_analysis_runs()


def delete_analysis_run(run_id: int) -> bool:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.delete_analysis_run(ctx.require_org(), run_id)
    return local_db.delete_analysis_run(run_id)


def get_analysis_run(run_id: int) -> dict[str, Any] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.get_analysis_run(ctx.require_org(), run_id)
    return local_db.get_analysis_run(run_id)


def create_sync_job(job_type: str) -> int:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.create_sync_job(ctx.require_org(), job_type)
    return local_db.create_sync_job(job_type)


def finish_sync_job(job_id: int, status: str, message: str) -> None:
    ctx = get_current_context()
    if ctx.is_cloud:
        cloud_db.finish_sync_job(ctx.require_org(), job_id, status, message)
    else:
        local_db.finish_sync_job(job_id, status, message)


def get_latest_sync_job(job_type: str | None = None) -> dict[str, Any] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.get_latest_sync_job(ctx.require_org(), job_type)
    return local_db.get_latest_sync_job(job_type)


def upsert_github_cache(
    username: str,
    *,
    public_repos: int | None,
    error: str | None,
    profile: dict[str, Any] | None = None,
) -> None:
    ctx = get_current_context()
    if ctx.is_cloud:
        cloud_db.upsert_github_cache(username, public_repos=public_repos, error=error, profile=profile)
    else:
        local_db.upsert_github_cache(username, public_repos=public_repos, error=error, profile=profile)


def get_github_cache_bulk(usernames: list[str]) -> dict[str, dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.get_github_cache_bulk(usernames)
    return local_db.get_github_cache_bulk(usernames)


def insert_email_message(**kwargs: Any) -> dict[str, Any]:
    ctx = get_current_context()
    if ctx.is_cloud:
        org_id = ctx.require_org()
        return cloud_db.insert_email_message(org_id, **kwargs)
    return local_db.insert_email_message(**kwargs)


def get_email_message(message_id: int) -> dict[str, Any] | None:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.get_email_message(ctx.require_org(), message_id)
    return local_db.get_email_message(message_id)


def list_email_messages(slug: str, *, analysis_run_id: int | None = None) -> list[dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.list_email_messages(ctx.require_org(), slug, analysis_run_id=analysis_run_id)
    return local_db.list_email_messages(slug, analysis_run_id=analysis_run_id)


def list_emails_for_run(analysis_run_id: int) -> list[dict[str, Any]]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.list_emails_for_run(ctx.require_org(), analysis_run_id)
    return local_db.list_emails_for_run(analysis_run_id)


def slugs_with_sent_outbound(slugs: list[str]) -> list[str]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_db.slugs_with_sent_outbound(ctx.require_org(), slugs)
    return local_db.slugs_with_sent_outbound(slugs)
