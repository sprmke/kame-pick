"""Postgres workflow repository — mirrors server/db.py with organization scoping."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from server.cloud.pg import execute, execute_returning, fetch_all, fetch_one, get_conn


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_candidate_note(org_id: str, slug: str) -> dict[str, Any] | None:
    row = fetch_one(
        """
        SELECT slug, status, starred, notes, tags, updated_at
        FROM candidate_notes
        WHERE organization_id = %s AND slug = %s
        """,
        (org_id, slug),
    )
    return _row_to_note(row) if row else None


def upsert_candidate_note(
    org_id: str,
    slug: str,
    *,
    status: str | None = None,
    starred: bool | None = None,
    notes: str | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    existing = get_candidate_note(org_id, slug) or {
        "slug": slug,
        "status": "new",
        "starred": False,
        "notes": "",
        "tags": [],
    }
    merged = {
        "slug": slug,
        "status": status if status is not None else existing["status"],
        "starred": starred if starred is not None else existing["starred"],
        "notes": notes if notes is not None else existing["notes"],
        "tags": tags if tags is not None else existing["tags"],
        "updated_at": _utc_now(),
    }
    execute(
        """
        INSERT INTO candidate_notes (organization_id, slug, status, starred, notes, tags, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s)
        ON CONFLICT (organization_id, slug) DO UPDATE SET
            status = EXCLUDED.status,
            starred = EXCLUDED.starred,
            notes = EXCLUDED.notes,
            tags = EXCLUDED.tags,
            updated_at = EXCLUDED.updated_at
        """,
        (
            org_id,
            slug,
            merged["status"],
            merged["starred"],
            merged["notes"],
            json.dumps(merged["tags"]),
            merged["updated_at"],
        ),
    )
    return merged


def list_all_notes(org_id: str) -> dict[str, dict[str, Any]]:
    rows = fetch_all(
        "SELECT slug, status, starred, notes, tags, updated_at FROM candidate_notes WHERE organization_id = %s",
        (org_id,),
    )
    return {row["slug"]: _row_to_note(row) for row in rows}


def save_analysis_run(org_id: str, name: str, filter_json: dict, results: list) -> int:
    row = execute_returning(
        """
        INSERT INTO analysis_runs (organization_id, name, filter_json, results_json, created_at)
        VALUES (%s, %s, %s::jsonb, %s::jsonb, %s)
        RETURNING id
        """,
        (org_id, name, json.dumps(filter_json), json.dumps(results), _utc_now()),
    )
    return int(row["id"]) if row else 0


def list_analysis_runs(org_id: str) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT id, name, filter_json, created_at
        FROM analysis_runs
        WHERE organization_id = %s
        ORDER BY id DESC
        """,
        (org_id,),
    )
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "filter": row["filter_json"] if isinstance(row["filter_json"], dict) else json.loads(row["filter_json"]),
            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
        }
        for row in rows
    ]


def delete_analysis_run(org_id: str, run_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM analysis_runs WHERE organization_id = %s AND id = %s",
            (org_id, run_id),
        )
        return cur.rowcount > 0


def get_analysis_run(org_id: str, run_id: int) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT * FROM analysis_runs WHERE organization_id = %s AND id = %s",
        (org_id, run_id),
    )
    if not row:
        return None
    filter_json = row["filter_json"]
    results_json = row["results_json"]
    if isinstance(filter_json, str):
        filter_json = json.loads(filter_json)
    if isinstance(results_json, str):
        results_json = json.loads(results_json)
    return {
        "id": row["id"],
        "name": row["name"],
        "filter": filter_json,
        "results": results_json,
        "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
    }


def create_sync_job(org_id: str, job_type: str) -> int:
    row = execute_returning(
        """
        INSERT INTO sync_jobs (organization_id, job_type, status, started_at)
        VALUES (%s, %s, 'running', %s)
        RETURNING id
        """,
        (org_id, job_type, _utc_now()),
    )
    return int(row["id"]) if row else 0


def finish_sync_job(org_id: str, job_id: int, status: str, message: str) -> None:
    execute(
        """
        UPDATE sync_jobs SET status = %s, message = %s, finished_at = %s
        WHERE organization_id = %s AND id = %s
        """,
        (status, message, _utc_now(), org_id, job_id),
    )


def get_latest_sync_job(org_id: str, job_type: str | None = None) -> dict[str, Any] | None:
    if job_type:
        row = fetch_one(
            """
            SELECT * FROM sync_jobs
            WHERE organization_id = %s AND job_type = %s
            ORDER BY id DESC LIMIT 1
            """,
            (org_id, job_type),
        )
    else:
        row = fetch_one(
            "SELECT * FROM sync_jobs WHERE organization_id = %s ORDER BY id DESC LIMIT 1",
            (org_id,),
        )
    return _row_to_sync_job(row) if row else None


def upsert_github_cache(
    username: str,
    *,
    public_repos: int | None,
    error: str | None,
    profile: dict[str, Any] | None = None,
) -> None:
    key = username.lower()
    profile_json = json.dumps(profile) if profile else None
    is_rate_limit = error and "rate" in error.lower()

    if is_rate_limit:
        execute(
            """
            INSERT INTO github_cache (username, public_repos, fetched_at, error, profile_json)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (username) DO UPDATE SET
                error = EXCLUDED.error,
                fetched_at = CASE
                    WHEN github_cache.profile_json IS NOT NULL THEN github_cache.fetched_at
                    ELSE EXCLUDED.fetched_at
                END
            """,
            (key, public_repos, _utc_now(), error, profile_json),
        )
        return

    execute(
        """
        INSERT INTO github_cache (username, public_repos, fetched_at, error, profile_json)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        ON CONFLICT (username) DO UPDATE SET
            public_repos = EXCLUDED.public_repos,
            fetched_at = EXCLUDED.fetched_at,
            error = EXCLUDED.error,
            profile_json = COALESCE(EXCLUDED.profile_json, github_cache.profile_json)
        """,
        (key, public_repos, _utc_now(), error, profile_json),
    )


def get_github_cache_bulk(usernames: list[str]) -> dict[str, dict[str, Any]]:
    if not usernames:
        return {}
    keys = list({u.lower() for u in usernames})
    placeholders = ",".join(["%s"] * len(keys))
    rows = fetch_all(
        f"""
        SELECT username, public_repos, fetched_at, error, profile_json
        FROM github_cache WHERE username IN ({placeholders})
        """,
        tuple(keys),
    )
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        profile = row.get("profile_json")
        if isinstance(profile, str):
            try:
                profile = json.loads(profile)
            except json.JSONDecodeError:
                profile = None
        result[row["username"]] = {
            "public_repos": row["public_repos"],
            "fetched_at": row["fetched_at"].isoformat() if hasattr(row["fetched_at"], "isoformat") else str(row["fetched_at"]),
            "error": row["error"],
            "profile": profile,
        }
    return result


def insert_email_message(
    org_id: str,
    *,
    slug: str,
    direction: str,
    from_email: str,
    to_email: str,
    subject: str,
    body_text: str,
    sent_at: str,
    gmail_message_id: str | None = None,
    gmail_thread_id: str | None = None,
    analysis_run_id: int | None = None,
    status: str = "sent",
    error: str | None = None,
) -> dict[str, Any]:
    row = execute_returning(
        """
        INSERT INTO email_messages (
            organization_id, slug, analysis_run_id, gmail_message_id, gmail_thread_id,
            direction, from_email, to_email, subject, body_text,
            sent_at, created_at, status, error
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            org_id, slug, analysis_run_id, gmail_message_id, gmail_thread_id,
            direction, from_email, to_email, subject, body_text,
            sent_at, _utc_now(), status, error,
        ),
    )
    return _row_to_email(row) if row else {}


def get_email_message(org_id: str, message_id: int) -> dict[str, Any] | None:
    row = fetch_one(
        "SELECT * FROM email_messages WHERE organization_id = %s AND id = %s",
        (org_id, message_id),
    )
    return _row_to_email(row) if row else None


def list_email_messages(
    org_id: str,
    slug: str,
    *,
    analysis_run_id: int | None = None,
) -> list[dict[str, Any]]:
    if analysis_run_id is not None:
        rows = fetch_all(
            """
            SELECT * FROM email_messages
            WHERE organization_id = %s AND slug = %s AND analysis_run_id = %s
            ORDER BY sent_at ASC, id ASC
            """,
            (org_id, slug, analysis_run_id),
        )
    else:
        rows = fetch_all(
            """
            SELECT * FROM email_messages
            WHERE organization_id = %s AND slug = %s
            ORDER BY sent_at ASC, id ASC
            """,
            (org_id, slug),
        )
    return [_row_to_email(row) for row in rows]


def list_emails_for_run(org_id: str, analysis_run_id: int) -> list[dict[str, Any]]:
    rows = fetch_all(
        """
        SELECT * FROM email_messages
        WHERE organization_id = %s AND analysis_run_id = %s
        ORDER BY sent_at ASC, id ASC
        """,
        (org_id, analysis_run_id),
    )
    return [_row_to_email(row) for row in rows]


def slugs_with_sent_outbound(org_id: str, slugs: list[str]) -> list[str]:
    if not slugs:
        return []
    placeholders = ",".join(["%s"] * len(slugs))
    rows = fetch_all(
        f"""
        SELECT DISTINCT slug FROM email_messages
        WHERE organization_id = %s AND slug IN ({placeholders})
          AND direction = 'outbound' AND status = 'sent'
        """,
        (org_id, *slugs),
    )
    return [row["slug"] for row in rows]


def _row_to_note(row: dict[str, Any]) -> dict[str, Any]:
    tags = row["tags"]
    if isinstance(tags, str):
        tags = json.loads(tags)
    updated = row["updated_at"]
    return {
        "slug": row["slug"],
        "status": row["status"],
        "starred": bool(row["starred"]),
        "notes": row["notes"],
        "tags": tags or [],
        "updated_at": updated.isoformat() if hasattr(updated, "isoformat") else str(updated),
    }


def _row_to_email(row: dict[str, Any]) -> dict[str, Any]:
    sent_at = row["sent_at"]
    created_at = row["created_at"]
    return {
        "id": row["id"],
        "slug": row["slug"],
        "analysis_run_id": row["analysis_run_id"],
        "gmail_message_id": row["gmail_message_id"],
        "gmail_thread_id": row["gmail_thread_id"],
        "direction": row["direction"],
        "from_email": row["from_email"],
        "to_email": row["to_email"],
        "subject": row["subject"],
        "body_text": row["body_text"],
        "sent_at": sent_at.isoformat() if hasattr(sent_at, "isoformat") else str(sent_at),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
        "status": row["status"],
        "error": row["error"],
    }


def _row_to_sync_job(row: dict[str, Any]) -> dict[str, Any]:
    started = row["started_at"]
    finished = row.get("finished_at")
    result = {
        "id": row["id"],
        "job_type": row["job_type"],
        "status": row["status"],
        "message": row["message"],
        "started_at": started.isoformat() if hasattr(started, "isoformat") else str(started),
    }
    if finished:
        result["finished_at"] = finished.isoformat() if hasattr(finished, "isoformat") else str(finished)
    return result
