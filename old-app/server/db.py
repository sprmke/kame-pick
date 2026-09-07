"""SQLite persistence for recruiter workflow state (notes, status, saved runs)."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from server.config import DB_PATH


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS candidate_notes (
                slug TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'new',
                starred INTEGER NOT NULL DEFAULT 0,
                notes TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS analysis_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                filter_json TEXT NOT NULL DEFAULT '{}',
                results_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sync_jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '',
                started_at TEXT NOT NULL,
                finished_at TEXT
            );

            CREATE TABLE IF NOT EXISTS github_cache (
                username TEXT PRIMARY KEY,
                public_repos INTEGER,
                fetched_at TEXT NOT NULL,
                error TEXT,
                profile_json TEXT
            );

            CREATE TABLE IF NOT EXISTS email_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL,
                analysis_run_id INTEGER,
                gmail_message_id TEXT,
                gmail_thread_id TEXT,
                direction TEXT NOT NULL,
                from_email TEXT NOT NULL DEFAULT '',
                to_email TEXT NOT NULL DEFAULT '',
                subject TEXT NOT NULL,
                body_text TEXT NOT NULL,
                sent_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'sent',
                error TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_email_messages_slug
                ON email_messages(slug);
            CREATE INDEX IF NOT EXISTS idx_email_messages_run
                ON email_messages(analysis_run_id);
            """
        )
        _migrate_github_cache(conn)


def _migrate_github_cache(conn: sqlite3.Connection) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(github_cache)").fetchall()}
    if "profile_json" not in cols:
        conn.execute("ALTER TABLE github_cache ADD COLUMN profile_json TEXT")


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def get_candidate_note(slug: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM candidate_notes WHERE slug = ?", (slug,)
        ).fetchone()
    if not row:
        return None
    return _row_to_note(row)


def upsert_candidate_note(
    slug: str,
    *,
    status: str | None = None,
    starred: bool | None = None,
    notes: str | None = None,
    tags: list[str] | None = None,
) -> dict[str, Any]:
    existing = get_candidate_note(slug) or {
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
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO candidate_notes (slug, status, starred, notes, tags, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
                status = excluded.status,
                starred = excluded.starred,
                notes = excluded.notes,
                tags = excluded.tags,
                updated_at = excluded.updated_at
            """,
            (
                slug,
                merged["status"],
                1 if merged["starred"] else 0,
                merged["notes"],
                json.dumps(merged["tags"]),
                merged["updated_at"],
            ),
        )
    return merged


def list_all_notes() -> dict[str, dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM candidate_notes").fetchall()
    return {row["slug"]: _row_to_note(row) for row in rows}


def save_analysis_run(name: str, filter_json: dict, results: list) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO analysis_runs (name, filter_json, results_json, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (name, json.dumps(filter_json), json.dumps(results), _utc_now()),
        )
        return int(cur.lastrowid)


def list_analysis_runs() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, filter_json, created_at FROM analysis_runs ORDER BY id DESC"
        ).fetchall()
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "filter": json.loads(row["filter_json"]),
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def delete_analysis_run(run_id: int) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM analysis_runs WHERE id = ?", (run_id,))
        return cur.rowcount > 0


def get_analysis_run(run_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM analysis_runs WHERE id = ?", (run_id,)
        ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "filter": json.loads(row["filter_json"]),
        "results": json.loads(row["results_json"]),
        "created_at": row["created_at"],
    }


def create_sync_job(job_type: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO sync_jobs (job_type, status, started_at)
            VALUES (?, 'running', ?)
            """,
            (job_type, _utc_now()),
        )
        return int(cur.lastrowid)


def finish_sync_job(job_id: int, status: str, message: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE sync_jobs SET status = ?, message = ?, finished_at = ?
            WHERE id = ?
            """,
            (status, message, _utc_now(), job_id),
        )


def get_latest_sync_job(job_type: str | None = None) -> dict[str, Any] | None:
    with get_conn() as conn:
        if job_type:
            row = conn.execute(
                "SELECT * FROM sync_jobs WHERE job_type = ? ORDER BY id DESC LIMIT 1",
                (job_type,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM sync_jobs ORDER BY id DESC LIMIT 1"
            ).fetchone()
    if not row:
        return None
    return dict(row)


def _row_to_note(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "slug": row["slug"],
        "status": row["status"],
        "starred": bool(row["starred"]),
        "notes": row["notes"],
        "tags": json.loads(row["tags"]),
        "updated_at": row["updated_at"],
    }


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

    with get_conn() as conn:
        if is_rate_limit:
            # Do not overwrite good cached data when GitHub throttles us.
            conn.execute(
                """
                INSERT INTO github_cache (username, public_repos, fetched_at, error, profile_json)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    error = excluded.error,
                    fetched_at = CASE
                        WHEN github_cache.profile_json IS NOT NULL THEN github_cache.fetched_at
                        ELSE excluded.fetched_at
                    END
                """,
                (key, public_repos, _utc_now(), error, profile_json),
            )
            return

        conn.execute(
            """
            INSERT INTO github_cache (username, public_repos, fetched_at, error, profile_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                public_repos = excluded.public_repos,
                fetched_at = excluded.fetched_at,
                error = excluded.error,
                profile_json = COALESCE(excluded.profile_json, github_cache.profile_json)
            """,
            (key, public_repos, _utc_now(), error, profile_json),
        )


def get_github_cache_bulk(usernames: list[str]) -> dict[str, dict[str, Any]]:
    if not usernames:
        return {}
    keys = list({u.lower() for u in usernames})
    placeholders = ",".join("?" * len(keys))
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT username, public_repos, fetched_at, error, profile_json
            FROM github_cache WHERE username IN ({placeholders})
            """,
            keys,
        ).fetchall()
    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        profile = None
        if row["profile_json"]:
            try:
                profile = json.loads(row["profile_json"])
            except json.JSONDecodeError:
                profile = None
        result[row["username"]] = {
            "public_repos": row["public_repos"],
            "fetched_at": row["fetched_at"],
            "error": row["error"],
            "profile": profile,
        }
    return result


def insert_email_message(
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
    created_at = _utc_now()
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO email_messages (
                slug, analysis_run_id, gmail_message_id, gmail_thread_id,
                direction, from_email, to_email, subject, body_text,
                sent_at, created_at, status, error
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                slug,
                analysis_run_id,
                gmail_message_id,
                gmail_thread_id,
                direction,
                from_email,
                to_email,
                subject,
                body_text,
                sent_at,
                created_at,
                status,
                error,
            ),
        )
        row_id = int(cur.lastrowid)
    return get_email_message(row_id) or {}


def get_email_message(message_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM email_messages WHERE id = ?", (message_id,)
        ).fetchone()
    return _row_to_email(row) if row else None


def list_email_messages(
    slug: str,
    *,
    analysis_run_id: int | None = None,
) -> list[dict[str, Any]]:
    query = "SELECT * FROM email_messages WHERE slug = ?"
    params: list[Any] = [slug]
    if analysis_run_id is not None:
        query += " AND analysis_run_id = ?"
        params.append(analysis_run_id)
    query += " ORDER BY sent_at ASC, id ASC"
    with get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [_row_to_email(row) for row in rows]


def list_emails_for_run(analysis_run_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM email_messages
            WHERE analysis_run_id = ?
            ORDER BY sent_at ASC, id ASC
            """,
            (analysis_run_id,),
        ).fetchall()
    return [_row_to_email(row) for row in rows]


def slugs_with_sent_outbound(slugs: list[str]) -> list[str]:
    """Return slugs that already have at least one sent outbound email."""
    if not slugs:
        return []
    placeholders = ",".join("?" * len(slugs))
    with get_conn() as conn:
        rows = conn.execute(
            f"""
            SELECT DISTINCT slug FROM email_messages
            WHERE slug IN ({placeholders})
              AND direction = 'outbound'
              AND status = 'sent'
            """,
            slugs,
        ).fetchall()
    return [row["slug"] for row in rows]


def _row_to_email(row: sqlite3.Row) -> dict[str, Any]:
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
        "sent_at": row["sent_at"],
        "created_at": row["created_at"],
        "status": row["status"],
        "error": row["error"],
    }
