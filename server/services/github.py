"""Fetch and cache GitHub profile and repository activity."""

from __future__ import annotations

import json
import os
import re
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import certifi

from server.env import load_project_env

load_project_env()

from server.db import get_conn, get_github_cache_bulk, upsert_github_cache
from server.services.candidates import load_manifest

GITHUB_USER_RE = re.compile(
    r"github\.com/(?!orgs/)([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)",
    re.IGNORECASE,
)

CACHE_MAX_AGE_HOURS = 24
ACTIVE_REPO_DAYS = 90


def parse_github_username(url: str) -> str | None:
    match = GITHUB_USER_RE.search(url)
    if not match:
        return None
    login = match.group(1)
    reserved = {"settings", "notifications", "explore", "topics", "collections", "events"}
    if login.lower() in reserved:
        return None
    return login


def username_from_urls(urls: list[str]) -> str | None:
    for url in urls:
        user = parse_github_username(url)
        if user:
            return user
    return None


def _github_token() -> str | None:
    token = os.getenv("GITHUB_TOKEN", "").strip()
    return token or None


def github_api_status() -> dict[str, Any]:
    """Check token presence and current GitHub rate-limit quota."""
    token = _github_token()
    data, err = _github_request("https://api.github.com/rate_limit")
    if err or not data:
        return {
            "token_configured": bool(token),
            "ok": False,
            "error": err or "Could not reach GitHub API",
        }
    core = data.get("resources", {}).get("core", {})
    return {
        "token_configured": bool(token),
        "ok": True,
        "limit": core.get("limit"),
        "remaining": core.get("remaining"),
        "reset_at": core.get("reset"),
        "authenticated": bool(token) and core.get("limit", 0) > 60,
    }


def _github_request(url: str) -> tuple[Any | None, str | None]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "job-applicants-analyzer",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = _github_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, headers=headers)
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    try:
        with urllib.request.urlopen(req, timeout=15, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8")), None
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None, "User not found"
        if exc.code == 403:
            return None, "Rate limited"
        return None, f"HTTP {exc.code}"
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def _parse_github_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def fetch_github_profile(username: str) -> tuple[dict[str, Any] | None, str | None]:
    """Full GitHub profile + repo activity for candidate links view."""
    user_data, err = _github_request(f"https://api.github.com/users/{username}")
    if err:
        return None, err
    if not user_data:
        return None, "User not found"

    repos_url = (
        f"https://api.github.com/users/{username}/repos?"
        + urllib.parse.urlencode(
            {"per_page": 100, "sort": "pushed", "direction": "desc", "type": "owner"}
        )
    )
    repos_data, repos_err = _github_request(repos_url)
    if repos_err and repos_err != "Rate limited":
        repos_data = []
    if repos_data is None:
        repos_data = []

    now = datetime.now(timezone.utc)
    all_repos = repos_data if isinstance(repos_data, list) else []
    owned = [r for r in all_repos if not r.get("fork")]
    forks_only = len(all_repos) - len(owned)

    active_repos: list[dict[str, Any]] = []
    last_push: datetime | None = None

    for repo in owned:
        pushed = _parse_github_datetime(repo.get("pushed_at") or repo.get("updated_at"))
        if pushed and (last_push is None or pushed > last_push):
            last_push = pushed
        days_ago = (now - pushed).days if pushed else 9999
        is_active = days_ago <= ACTIVE_REPO_DAYS
        if is_active:
            active_repos.append(repo)

    top_repos = sorted(owned, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:6]
    recent_active = sorted(
        active_repos,
        key=lambda r: r.get("pushed_at") or "",
        reverse=True,
    )[:5]

    def repo_summary(r: dict[str, Any]) -> dict[str, Any]:
        pushed = r.get("pushed_at") or r.get("updated_at")
        pushed_dt = _parse_github_datetime(pushed)
        days = (now - pushed_dt).days if pushed_dt else None
        return {
            "name": r.get("name"),
            "url": r.get("html_url"),
            "description": (r.get("description") or "")[:120] or None,
            "language": r.get("language"),
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "is_fork": bool(r.get("fork")),
            "pushed_at": pushed,
            "days_since_push": days,
            "is_active": days is not None and days <= ACTIVE_REPO_DAYS,
        }

    days_since_last = (now - last_push).days if last_push else None

    profile = {
        "username": username,
        "profile_url": user_data.get("html_url"),
        "avatar_url": user_data.get("avatar_url"),
        "bio": user_data.get("bio"),
        "public_repos": user_data.get("public_repos", len(owned)),
        "followers": user_data.get("followers", 0),
        "following": user_data.get("following", 0),
        "account_created_at": user_data.get("created_at"),
        "owned_repo_count": len(owned),
        "fork_repos_count": forks_only,
        "active_repo_count": len(active_repos),
        "inactive_repo_count": max(0, len(owned) - len(active_repos)),
        "is_active": len(active_repos) > 0,
        "activity_label": _activity_label(len(active_repos), days_since_last),
        "last_pushed_at": last_push.isoformat() if last_push else None,
        "days_since_last_push": days_since_last,
        "total_stars": sum(r.get("stargazers_count", 0) for r in owned),
        "top_repos": [repo_summary(r) for r in top_repos],
        "recent_active_repos": [repo_summary(r) for r in recent_active],
        "fetched_at": now.isoformat(),
    }
    return profile, repos_err if repos_err == "Rate limited" and not owned else None


def _activity_label(active_count: int, days_since: int | None) -> str:
    if active_count == 0:
        return "Inactive (no pushes in 90 days)"
    if days_since is None:
        return "Active"
    if days_since <= 7:
        return "Very active"
    if days_since <= 30:
        return "Active"
    if days_since <= 90:
        return "Moderately active"
    return "Inactive"


def get_github_profile(username: str, *, refresh: bool = False) -> dict[str, Any]:
    key = username.lower()
    cache = get_github_cache_bulk([key]).get(key)

    if cache and not refresh:
        if cache.get("profile"):
            return {
                "username": username,
                **cache["profile"],
                "from_cache": True,
                "stale_rate_limit": bool(cache.get("error")),
            }
        if cache.get("error"):
            return {"username": username, "error": cache["error"], "from_cache": True}

    profile, err = fetch_github_profile(username)
    public_repos = profile.get("public_repos") if profile else None
    upsert_github_cache(username, public_repos=public_repos, error=err, profile=profile)

    if err and not profile:
        return {"username": username, "error": err, "from_cache": False}
    return {"username": username, **(profile or {}), "from_cache": False}


def get_cached_repo_count(username: str) -> int | None:
    row = get_github_cache_bulk([username]).get(username.lower())
    if not row:
        return None
    if row.get("error") and not row.get("profile"):
        return None
    if row.get("profile"):
        return row["profile"].get("public_repos")
    return row.get("public_repos")


def _is_stale_rate_limit(row: dict[str, Any] | None) -> bool:
    if not row:
        return False
    err = (row.get("error") or "").lower()
    return "rate" in err and not row.get("profile")


def refresh_stale_rate_limits(logins: list[str]) -> int:
    """Re-fetch profiles cached as rate-limited before a token was configured."""
    if not _github_token() or not logins:
        return 0

    keys = list({login.lower() for login in logins})
    cache = get_github_cache_bulk(keys)
    refreshed = 0

    for login in logins:
        row = cache.get(login.lower())
        if not _is_stale_rate_limit(row):
            continue
        profile, err = fetch_github_profile(login)
        public_repos = profile.get("public_repos") if profile else None
        upsert_github_cache(login, public_repos=public_repos, error=err, profile=profile)
        refreshed += 1

    return refreshed


def enrich_entries_with_github(entries: list[dict[str, Any]]) -> None:
    usernames: list[str] = []

    for entry in entries:
        urls = entry.get("github_urls") or []
        user = username_from_urls(urls)
        entry["github_username"] = user
        if user:
            usernames.append(user.lower())

    cache = get_github_cache_bulk(list(set(usernames)))
    for entry in entries:
        user = entry.get("github_username")
        if not user:
            entry["github_repo_count"] = None
            entry["github_fetch_error"] = None
            continue
        row = cache.get(user.lower())
        profile = row.get("profile") if row else None
        if profile:
            entry["github_repo_count"] = profile.get("public_repos")
            entry["github_fetch_error"] = None
        elif row and row.get("error"):
            entry["github_repo_count"] = row.get("public_repos")
            entry["github_fetch_error"] = row["error"]
        else:
            entry["github_repo_count"] = None
            entry["github_fetch_error"] = None


def retry_all_stale_rate_limits() -> dict[str, Any]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT username FROM github_cache
            WHERE error IS NOT NULL
              AND lower(error) LIKE '%rate%'
              AND (profile_json IS NULL OR profile_json = '')
            """
        ).fetchall()
    logins = [row[0] for row in rows]
    refreshed = refresh_stale_rate_limits(logins)
    return {"stale_count": len(logins), "refreshed": refreshed}


def refresh_github_stats(*, force: bool = False, slugs: list[str] | None = None) -> dict[str, Any]:
    manifest = load_manifest()
    entries = manifest.get("candidates", [])
    if slugs:
        slug_set = set(slugs)
        entries = [e for e in entries if e["slug"] in slug_set]

    usernames: dict[str, str] = {}
    for entry in entries:
        user = username_from_urls(entry.get("github_urls") or [])
        if user:
            usernames[user.lower()] = user

    cache = get_github_cache_bulk(list(usernames.keys()))
    now = datetime.now(timezone.utc)
    to_fetch: list[str] = []

    for key, login in usernames.items():
        row = cache.get(key)
        if force or not row:
            to_fetch.append(login)
            continue
        if row.get("error") or not row.get("profile"):
            to_fetch.append(login)
            continue
        fetched = row.get("fetched_at")
        if fetched:
            try:
                dt = datetime.fromisoformat(fetched.replace("Z", "+00:00"))
                age_h = (now - dt).total_seconds() / 3600
                if age_h >= CACHE_MAX_AGE_HOURS:
                    to_fetch.append(login)
            except ValueError:
                to_fetch.append(login)

    updated = 0
    errors = 0
    for i, login in enumerate(to_fetch):
        if i > 0:
            time.sleep(0.5 if _github_token() else 1.5)
        profile, err = fetch_github_profile(login)
        public_repos = profile.get("public_repos") if profile else None
        upsert_github_cache(login, public_repos=public_repos, error=err, profile=profile)
        if err and not profile:
            errors += 1
        else:
            updated += 1

    return {
        "total_profiles": len(usernames),
        "fetched": len(to_fetch),
        "updated": updated,
        "errors": errors,
    }


def refresh_github_stats_background(*, force: bool = False, slugs: list[str] | None = None) -> None:
    threading.Thread(
        target=refresh_github_stats,
        kwargs={"force": force, "slugs": slugs},
        daemon=True,
    ).start()
