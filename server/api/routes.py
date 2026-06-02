from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from server.api.schemas import (
    BatchEmailRequest,
    CandidateNoteUpdate,
    GithubRefreshRequest,
    JobCriteriaUpdate,
    RankPreviewRequest,
    RankRequest,
    SendEmailRequest,
    SyncRequest,
)
from server.services.filters import RankFilterConfig, get_filter_options, preview_filters, rank_with_filters
from server.stores import candidates as candidate_store
from server.stores import criteria as criteria_store
from server.stores import workflow as workflow_store
from server.stores.context import get_current_context
from server.services.ranking import enrich_ranked_results
from server.services.github import (
    enrich_entries_with_github,
    get_github_profile,
    github_api_status,
    refresh_github_stats,
    refresh_github_stats_background,
    refresh_stale_rate_limits,
    retry_all_stale_rate_limits,
    username_from_urls,
)
from server.services.scorer import rank_all_candidates, score_candidate
from server.services.email_outreach import (
    get_default_email_template,
    get_email_thread,
    get_run_email_activity,
    gmail_send_ready,
    preview_candidate_email,
    send_batch_emails,
    send_candidate_email,
)
from server.services.sync import run_extract_resumes, run_fetch_emails, run_full_sync

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/dashboard")
def dashboard() -> dict[str, Any]:
    manifest = candidate_store.load_manifest()
    candidates = manifest.get("candidates", [])
    notes = workflow_store.list_all_notes()
    status_counts: dict[str, int] = {}
    starred = 0
    for n in notes.values():
        status_counts[n["status"]] = status_counts.get(n["status"], 0) + 1
        if n["starred"]:
            starred += 1

    with_github = sum(1 for c in candidates if c.get("github_urls"))
    with_attachments = sum(1 for c in candidates if c.get("attachment_count", 0) > 0)

    return {
        "total_candidates": len(candidates),
        "with_github": with_github,
        "with_attachments": with_attachments,
        "manifest_updated_at": manifest.get("updated_at"),
        "status_counts": status_counts,
        "starred_count": starred,
        "reports_count": len(workflow_store.list_analysis_runs()),
        "analysis_runs_count": len(workflow_store.list_analysis_runs()),
        "latest_sync": workflow_store.get_latest_sync_job(),
        "role": criteria_store.load_criteria().get("role", "AI-Assisted Web Developer"),
    }


@router.get("/candidates")
def list_candidates(
    q: str = "",
    status: str | None = None,
    starred_only: bool = False,
    has_github: bool | None = None,
    sort: str = Query(
        "score",
        pattern="^(received_at|name|score|tier|status|github_repos)$",
    ),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    include_scores: bool = True,
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=50),
) -> dict[str, Any]:
    manifest = candidate_store.load_manifest()
    notes = workflow_store.list_all_notes()
    items: list[dict[str, Any]] = []

    for entry in manifest.get("candidates", []):
        slug = entry["slug"]
        note = notes.get(slug, {"status": "new", "starred": False, "notes": "", "tags": []})

        if status and note.get("status") != status:
            continue
        if starred_only and not note.get("starred"):
            continue
        if has_github is True and not entry.get("github_urls"):
            continue
        if has_github is False and entry.get("github_urls"):
            continue

        search_blob = " ".join(
            [
                entry.get("name") or "",
                entry.get("email") or "",
                entry.get("subject") or "",
                slug,
            ]
        ).lower()
        if q and q.lower() not in search_blob:
            continue

        item = {**entry, "note": note}
        if include_scores:
            item["score"] = score_candidate(slug).to_dict()
        items.append(item)

    enrich_entries_with_github(items)

    reverse = order == "desc"
    tier_rank = {"tier_a": 4, "tier_b": 3, "auto_pass": 2, "unknown": 1}

    def _shortlisted_first_rank(item: dict[str, Any]) -> int:
        status = (item.get("note") or {}).get("status", "new")
        return 0 if status == "shortlisted" else 1

    if sort == "name":
        items.sort(key=lambda x: (x.get("name") or x.get("slug") or "").lower(), reverse=reverse)
    elif sort == "score":
        items.sort(
            key=lambda x: (
                _shortlisted_first_rank(x),
                -(x.get("score", {}).get("total_score", 0))
                if reverse
                else x.get("score", {}).get("total_score", 0),
            ),
        )
    elif sort == "tier":
        items.sort(
            key=lambda x: tier_rank.get(x.get("score", {}).get("experience_tier", ""), 0),
            reverse=reverse,
        )
    elif sort == "status":
        items.sort(
            key=lambda x: (x.get("note") or {}).get("status", "new").lower(),
            reverse=reverse,
        )
    elif sort == "github_repos":
        items.sort(
            key=lambda x: x.get("github_repo_count") if x.get("github_repo_count") is not None else -1,
            reverse=reverse,
        )
    else:
        items.sort(key=lambda x: x.get("received_at") or "", reverse=reverse)

    total = len(items)
    if per_page not in (10, 15, 25, 50):
        per_page = 15
    total_pages = max(1, (total + per_page - 1) // per_page)
    page = min(page, total_pages)
    start = (page - 1) * per_page
    page_items = items[start : start + per_page]

    page_logins = [
        u
        for e in page_items
        if (u := username_from_urls(e.get("github_urls") or []))
    ]
    if page_logins:
        refresh_stale_rate_limits(page_logins)

    return {
        "candidates": page_items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.get("/github/status")
def github_status() -> dict[str, Any]:
    return github_api_status()


@router.post("/github/retry-stale")
def github_retry_stale() -> dict[str, Any]:
    """Re-fetch every profile still cached as rate-limited (no profile data)."""
    return retry_all_stale_rate_limits()


@router.post("/github/refresh")
def github_refresh(body: GithubRefreshRequest | None = None) -> dict[str, Any]:
    body = body or GithubRefreshRequest()
    if body.background:
        refresh_github_stats_background(force=body.force, slugs=body.slugs)
        scope = f"{len(body.slugs)} on this page" if body.slugs else "all candidates"
        return {"status": "started", "message": f"Fetching GitHub data for {scope}"}
    return refresh_github_stats(force=body.force, slugs=body.slugs)


@router.get("/candidates/{slug}/github-insights")
def candidate_github_insights(slug: str, refresh: bool = False) -> dict[str, Any]:
    data = candidate_store.get_candidate_full(slug)
    if not data:
        raise HTTPException(404, "Candidate not found")
    urls = data.get("links", {}).get("github", []) or data.get("github_urls", [])
    username = username_from_urls(urls)
    if not username:
        raise HTTPException(404, "No GitHub URL for this candidate")
    return get_github_profile(username, refresh=refresh)


@router.get("/gmail/status")
def gmail_status() -> dict[str, Any]:
    return gmail_send_ready()


@router.get("/email/template")
def email_template() -> dict[str, Any]:
    return get_default_email_template()


@router.get("/candidates/{slug}/emails")
def candidate_emails(
    slug: str,
    run_id: int | None = Query(None, alias="run_id"),
) -> dict[str, Any]:
    if not candidate_store.get_candidate_full(slug):
        raise HTTPException(404, "Candidate not found")
    return get_email_thread(slug, analysis_run_id=run_id)


@router.post("/candidates/{slug}/emails/preview")
def preview_candidate_email_route(slug: str, body: SendEmailRequest) -> dict[str, Any]:
    if not candidate_store.get_candidate_full(slug):
        raise HTTPException(404, "Candidate not found")
    try:
        return preview_candidate_email(
            slug,
            subject=body.subject,
            body=body.body,
            reply=body.reply,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.post("/candidates/{slug}/emails")
def send_candidate_email_route(slug: str, body: SendEmailRequest) -> dict[str, Any]:
    if not candidate_store.get_candidate_full(slug):
        raise HTTPException(404, "Candidate not found")
    try:
        return send_candidate_email(
            slug,
            subject=body.subject,
            body=body.body,
            analysis_run_id=body.analysis_run_id,
            reply=body.reply,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.get("/emails/contacted-slugs")
def contacted_slugs_route(slugs: str = Query("")) -> dict[str, Any]:
    slug_list = [s.strip() for s in slugs.split(",") if s.strip()]
    return {"slugs": workflow_store.slugs_with_sent_outbound(slug_list)}


@router.post("/emails/batch")
def send_batch_email_route(body: BatchEmailRequest) -> dict[str, Any]:
    for slug in body.slugs:
        if not candidate_store.get_candidate_full(slug):
            raise HTTPException(400, f"Unknown candidate: {slug}")
    return send_batch_emails(
        body.slugs,
        subject=body.subject,
        body=body.body,
        analysis_run_id=body.analysis_run_id,
        reply=body.reply,
    )


@router.get("/analyze/runs/{run_id}/emails")
def run_email_activity(run_id: int) -> dict[str, Any]:
    if not workflow_store.get_analysis_run(run_id):
        raise HTTPException(404, "Report not found")
    return get_run_email_activity(run_id)


@router.get("/candidates/{slug}")
def get_candidate(slug: str) -> dict[str, Any]:
    data = candidate_store.get_candidate_full(slug)
    if not data:
        raise HTTPException(404, "Candidate not found")
    data["note"] = workflow_store.get_candidate_note(slug) or {
        "slug": slug,
        "status": "new",
        "starred": False,
        "notes": "",
        "tags": [],
    }
    data["score"] = score_candidate(slug).to_dict()
    enrich_entries_with_github([data])
    return data


@router.patch("/candidates/{slug}/note")
def update_candidate_note(slug: str, body: CandidateNoteUpdate) -> dict[str, Any]:
    if not candidate_store.candidate_exists(slug):
        raise HTTPException(404, "Candidate not found")
    return workflow_store.upsert_candidate_note(
        slug,
        status=body.status,
        starred=body.starred,
        notes=body.notes,
        tags=body.tags,
    )


@router.get("/candidates/{slug}/attachment/{filename}")
def download_attachment(slug: str, filename: str) -> Response:
    result = candidate_store.get_attachment_bytes(slug, filename)
    if not result:
        raise HTTPException(404, "Attachment not found")
    data, media_type = result
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/analyze/filter-options")
def analyze_filter_options() -> dict[str, Any]:
    return get_filter_options()


@router.post("/analyze/preview")
def analyze_preview(body: RankPreviewRequest) -> dict[str, Any]:
    cfg = RankFilterConfig.from_dict(body.model_dump())
    cfg.top_n = 0
    return preview_filters(cfg)


@router.post("/analyze/rank")
def analyze_rank(body: RankRequest) -> dict[str, Any]:
    cfg = RankFilterConfig.from_dict(body.model_dump())
    ranked, stats = rank_with_filters(cfg)
    ranked = enrich_ranked_results(ranked)
    filters = body.model_dump(exclude={"save_run", "report_name"})
    run_id = None

    if body.save_run:
        run_id = workflow_store.save_analysis_run(body.report_name, filters, ranked)

    return {
        "ranked": ranked,
        "count": len(ranked),
        "filters": filters,
        "stats": stats,
        "run_id": run_id,
    }


@router.get("/analyze/runs")
def analyze_runs() -> dict[str, Any]:
    return {"runs": workflow_store.list_analysis_runs()}


@router.get("/analyze/runs/{run_id}")
def analyze_run_detail(run_id: int) -> dict[str, Any]:
    run = workflow_store.get_analysis_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    run["results"] = enrich_ranked_results(run.get("results", []))
    return run


@router.get("/reports")
def reports_list() -> dict[str, Any]:
    return {"reports": workflow_store.list_analysis_runs()}


@router.get("/reports/{run_id}")
def reports_get(run_id: int) -> dict[str, Any]:
    run = workflow_store.get_analysis_run(run_id)
    if not run:
        raise HTTPException(404, "Report not found")
    run["results"] = enrich_ranked_results(run.get("results", []))
    return run


@router.delete("/reports/{run_id}")
def reports_delete(run_id: int) -> dict[str, str]:
    if not workflow_store.delete_analysis_run(run_id):
        raise HTTPException(404, "Report not found")
    return {"status": "deleted"}


@router.get("/settings/job-criteria")
def get_job_criteria() -> dict[str, Any]:
    data = criteria_store.get_job_criteria_response()
    if not data.get("raw") and not data.get("parsed"):
        raise HTTPException(404, "job-criteria not found")
    return data


@router.put("/settings/job-criteria")
def put_job_criteria(body: JobCriteriaUpdate) -> dict[str, str]:
    import yaml

    try:
        yaml.safe_load(body.content)
    except yaml.YAMLError as exc:
        raise HTTPException(400, f"Invalid YAML: {exc}") from exc
    criteria_store.save_job_criteria(body.content)
    return {"status": "saved"}


@router.post("/sync/fetch")
def sync_fetch(body: SyncRequest) -> dict[str, Any]:
    run_fetch_emails(only_new=body.only_new, force=body.force)
    return {"status": "started", "job_type": "fetch_emails"}


@router.post("/sync/extract")
def sync_extract() -> dict[str, Any]:
    run_extract_resumes()
    return {"status": "started", "job_type": "extract_resumes"}


@router.post("/sync/full")
def sync_full(body: SyncRequest) -> dict[str, Any]:
    run_full_sync(only_new=body.only_new)
    return {"status": "started", "job_type": "full_sync"}


@router.get("/sync/status")
def sync_status() -> dict[str, Any]:
    return {
        "fetch": workflow_store.get_latest_sync_job("fetch_emails"),
        "extract": workflow_store.get_latest_sync_job("extract_resumes"),
        "full": workflow_store.get_latest_sync_job("full_sync"),
        "candidates_dir_exists": candidate_store.candidates_dir_exists(),
    }


@router.get("/org/me")
def org_me() -> dict[str, Any]:
    ctx = get_current_context()
    if not ctx.is_cloud:
        return {"mode": "local"}
    from server.cloud.auth import list_user_organizations
    orgs = list_user_organizations(ctx.user_id or "")
    return {
        "mode": "cloud",
        "user_id": ctx.user_id,
        "email": ctx.email,
        "organization_id": ctx.organization_id,
        "org_role": ctx.org_role,
        "organizations": orgs,
    }


@router.get("/gmail/connect-url")
def gmail_connect_url() -> dict[str, str]:
    ctx = get_current_context()
    if not ctx.is_cloud or not ctx.user_id:
        raise HTTPException(400, "Cloud mode with authentication required")
    from server.cloud.gmail_oauth import build_authorize_url, oauth_configured
    if not oauth_configured():
        raise HTTPException(503, "Google OAuth not configured on server")
    url = build_authorize_url(ctx.require_org(), ctx.user_id)
    return {"url": url}


@router.get("/gmail/oauth/callback")
def gmail_oauth_callback(code: str = "", state: str = "") -> dict[str, Any]:
    if not code or not state:
        raise HTTPException(400, "Missing code or state")
    from server.cloud.gmail_oauth import exchange_code
    return exchange_code(code, state)


@router.delete("/gmail/disconnect")
def gmail_disconnect() -> dict[str, str]:
    ctx = get_current_context()
    if not ctx.is_cloud or not ctx.user_id:
        raise HTTPException(400, "Cloud mode required")
    from server.cloud.gmail_oauth import delete_connection
    delete_connection(ctx.require_org(), ctx.user_id)
    return {"status": "disconnected"}


@router.post("/import/local")
def import_local_data() -> dict[str, Any]:
    """Import local filesystem candidates into cloud (one-time migration)."""
    ctx = get_current_context()
    if not ctx.is_cloud:
        raise HTTPException(400, "Cloud mode required")
    from server.cloud.import_local import import_local_candidates
    result = import_local_candidates(ctx.require_org())
    return result
