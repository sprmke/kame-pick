"""Candidate filtering for ranking and analysis."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from server.stores import workflow as workflow_store
from server.stores import candidates as candidate_store
from server.services.github import username_from_urls
from server.services.scorer import ScoreBreakdown, load_criteria, score_candidate


@dataclass
class CandidateProfile:
    slug: str
    name: str
    email: str
    received_at: str
    github_urls: list[str]
    attachment_count: int
    score: ScoreBreakdown
    text: str
    estimated_gender: str  # female, male, unknown
    estimated_age: int | None
    github_repo_count: int | None
    location_hits: list[str] = field(default_factory=list)


@dataclass
class RankFilterConfig:
    filipino_only: bool = True
    exclude_auto_pass: bool = True
    min_dev_years: float | None = None
    max_dev_years: float | None = 2.0
    experience_level: str = "any"  # any | fresh_grad | has_work_exp | intern_only
    has_github: bool | None = None
    min_github_repos: int | None = None
    tech_any: list[str] = field(default_factory=list)
    tech_all: list[str] = field(default_factory=list)
    locations: list[str] = field(default_factory=list)
    gender: str = "any"  # any | female | male
    min_age: int | None = None
    max_age: int | None = None
    has_honors: bool | None = None
    has_ai_tools: bool | None = None
    min_score: int | None = None
    tiers: list[str] = field(default_factory=list)
    top_n: int = 10

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RankFilterConfig:
        return cls(
            filipino_only=bool(data.get("filipino_only", True)),
            exclude_auto_pass=bool(data.get("exclude_auto_pass", True)),
            min_dev_years=data.get("min_dev_years"),
            max_dev_years=data.get("max_dev_years", 2.0),
            experience_level=str(data.get("experience_level", "any")),
            has_github=data.get("has_github"),
            min_github_repos=data.get("min_github_repos"),
            tech_any=list(data.get("tech_any") or []),
            tech_all=list(data.get("tech_all") or []),
            locations=list(data.get("locations") or []),
            gender=str(data.get("gender", "any")),
            min_age=data.get("min_age"),
            max_age=data.get("max_age"),
            has_honors=data.get("has_honors"),
            has_ai_tools=data.get("has_ai_tools"),
            min_score=data.get("min_score"),
            tiers=list(data.get("tiers") or []),
            top_n=int(data.get("top_n", 10)),
        )


def estimate_gender(text: str) -> str:
    t = text.lower()
    female = [
        r"\bshe/her\b",
        r"\bher pronouns\b",
        r"\bgender\s*:\s*f(?:emale)?\b",
        r"\bsex\s*:\s*f(?:emale)?\b",
        r"\bfemale\b",
        r"\bmiss\b",
        r"\bmrs\.?\b",
        r"\bms\.?\b",
    ]
    male = [
        r"\bhe/him\b",
        r"\bhis pronouns\b",
        r"\bgender\s*:\s*m(?:ale)?\b",
        r"\bsex\s*:\s*m(?:ale)?\b",
        r"\bmale\b",
        r"\bmr\.?\b",
    ]
    f_score = sum(1 for p in female if re.search(p, t))
    m_score = sum(1 for p in male if re.search(p, t))
    if f_score > m_score and f_score > 0:
        return "female"
    if m_score > f_score and m_score > 0:
        return "male"
    return "unknown"


def estimate_age(text: str, reference_year: int = 2026) -> int | None:
    t = text.lower()
    m = re.search(r"\bage\s*[:\-]?\s*(\d{2})\b", t)
    if m:
        age = int(m.group(1))
        if 16 <= age <= 70:
            return age
    m = re.search(r"\b(\d{2})\s*years?\s*old\b", t)
    if m:
        age = int(m.group(1))
        if 16 <= age <= 70:
            return age
    for pattern in [
        r"\bborn\s*[:\-]?\s*(\d{4})\b",
        r"\bbirth\s*(?:year|date)?\s*[:\-]?\s*(\d{4})\b",
        r"\bdob\s*[:\-]?\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b",
    ]:
        m = re.search(pattern, t)
        if m:
            if len(m.groups()) == 1:
                year = int(m.group(1))
                if 1950 <= year <= reference_year:
                    return reference_year - year
            elif len(m.groups()) == 3:
                year = int(m.group(3))
                if 1950 <= year <= reference_year:
                    return reference_year - year
    m = re.search(r"\bbatch\s*(\d{4})\b", t)
    if m:
        year = int(m.group(1))
        if 2015 <= year <= reference_year + 1:
            return max(0, reference_year - year + 22)
    return None


def _location_hits(text: str, criteria: dict) -> list[str]:
    preferred = criteria.get("location", {}).get("preferred_regions", [])
    keywords = list(preferred) + [
        "philippines",
        "pampanga",
        "region iii",
        "central luzon",
        "metro manila",
        "ncr",
        "cebu",
        "davao",
        "angeles",
        "clark",
    ]
    hits = []
    lower = text.lower()
    for kw in keywords:
        if kw.lower() in lower:
            hits.append(kw)
    return list(dict.fromkeys(hits))


def build_candidate_profile(entry: dict[str, Any], criteria: dict | None = None) -> CandidateProfile:
    criteria = criteria or load_criteria()
    slug = entry["slug"]
    text = candidate_store.get_combined_text_for_scoring(slug)
    breakdown = score_candidate(slug, criteria)
    links = candidate_store.load_links(slug)
    user = username_from_urls(links.get("github", []) + entry.get("github_urls", []))
    repo_count = None
    if user:
        cache = workflow_store.get_github_cache_bulk([user.lower()])
        row = cache.get(user.lower())
        if row and not row.get("error"):
            repo_count = row.get("public_repos")

    return CandidateProfile(
        slug=slug,
        name=entry.get("name") or slug,
        email=entry.get("email") or "",
        received_at=entry.get("received_at") or "",
        github_urls=entry.get("github_urls") or links.get("github", []),
        attachment_count=entry.get("attachment_count", 0),
        score=breakdown,
        text=text,
        estimated_gender=estimate_gender(text),
        estimated_age=estimate_age(text),
        github_repo_count=repo_count,
        location_hits=_location_hits(text, criteria),
    )


def passes_filters(profile: CandidateProfile, cfg: RankFilterConfig, criteria: dict) -> tuple[bool, str | None]:
    sc = profile.score

    if cfg.filipino_only and not sc.filipino_verified:
        return False, "Not Filipino-verified"
    if cfg.exclude_auto_pass and sc.auto_pass:
        return False, sc.auto_pass_reason or "Auto-pass"
    if cfg.tiers and sc.experience_tier not in cfg.tiers:
        return False, f"Tier {sc.experience_tier}"
    if cfg.min_dev_years is not None:
        years = sc.experience_years if sc.experience_years is not None else 0
        if years < cfg.min_dev_years:
            return False, "Below min experience"
    if cfg.max_dev_years is not None and sc.experience_years is not None:
        if sc.experience_years >= cfg.max_dev_years:
            return False, "Above max experience"

    if cfg.experience_level == "fresh_grad":
        if sc.experience_tier not in ("tier_b", "unknown") and (sc.experience_years or 0) > 0.5:
            if not re.search(r"fresh\s+grad|new\s+grad|recent\s+grad", profile.text, re.I):
                return False, "Not fresh grad"
    elif cfg.experience_level == "has_work_exp":
        if (sc.experience_years or 0) < 0.25 and sc.experience_tier == "tier_b":
            if not re.search(r"developer|engineer|internship", profile.text, re.I):
                return False, "No work experience"
    elif cfg.experience_level == "intern_only":
        if not re.search(r"intern(?:ship)?|ojt|on[\s-]?the[\s-]?job", profile.text, re.I):
            return False, "No intern/OJT signal"

    if cfg.has_github is True and not profile.github_urls:
        return False, "No GitHub"
    if cfg.has_github is False and profile.github_urls:
        return False, "Has GitHub"

    if cfg.min_github_repos is not None:
        count = profile.github_repo_count
        if count is None or count < cfg.min_github_repos:
            return False, "GitHub repos below minimum"

    lower = profile.text
    if cfg.tech_any:
        if not any(t.lower() in lower for t in cfg.tech_any):
            return False, "Tech stack (any) not matched"
    if cfg.tech_all:
        missing = [t for t in cfg.tech_all if t.lower() not in lower]
        if missing:
            return False, f"Missing tech: {', '.join(missing[:3])}"

    if cfg.locations:
        loc_lower = lower
        if not any(loc.lower() in loc_lower for loc in cfg.locations):
            return False, "Location not matched"

    if cfg.gender == "female" and profile.estimated_gender != "female":
        return False, "Gender filter (est.)"
    if cfg.gender == "male" and profile.estimated_gender != "male":
        return False, "Gender filter (est.)"

    if cfg.min_age is not None:
        if profile.estimated_age is None or profile.estimated_age < cfg.min_age:
            return False, "Below min age (est.)"
    if cfg.max_age is not None:
        if profile.estimated_age is None or profile.estimated_age > cfg.max_age:
            return False, "Above max age (est.)"

    if cfg.has_honors is True and not sc.honors_found:
        return False, "No honors"
    if cfg.has_honors is False and sc.honors_found:
        return False, "Has honors"

    if cfg.has_ai_tools is True and not sc.ai_tools_found:
        return False, "No AI tools"
    if cfg.has_ai_tools is False and sc.ai_tools_found:
        return False, "Has AI tools"

    if cfg.min_score is not None and sc.total_score < cfg.min_score:
        return False, "Below min score"

    return True, None


def profile_to_result(profile: CandidateProfile) -> dict[str, Any]:
    return {
        "slug": profile.slug,
        "name": profile.name,
        "email": profile.email,
        "received_at": profile.received_at,
        "github_urls": profile.github_urls,
        "attachment_count": profile.attachment_count,
        "score": profile.score.to_dict(),
        "estimated_gender": profile.estimated_gender,
        "estimated_age": profile.estimated_age,
        "github_repo_count": profile.github_repo_count,
        "location_hits": profile.location_hits,
    }


def rank_with_filters(cfg: RankFilterConfig) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    manifest = candidate_store.load_manifest()
    criteria = load_criteria()
    total = len(manifest.get("candidates", []))
    matched: list[CandidateProfile] = []
    exclusion_counts: dict[str, int] = {}

    for entry in manifest.get("candidates", []):
        profile = build_candidate_profile(entry, criteria)
        ok, reason = passes_filters(profile, cfg, criteria)
        if ok:
            matched.append(profile)
        elif reason:
            exclusion_counts[reason] = exclusion_counts.get(reason, 0) + 1

    matched.sort(key=lambda p: p.score.total_score, reverse=True)
    top = matched[: cfg.top_n] if cfg.top_n else matched

    stats = {
        "total_synced": total,
        "matched_pool": len(matched),
        "returned": len(top),
        "exclusion_counts": exclusion_counts,
    }
    return [profile_to_result(p) for p in top], stats


def preview_filters(cfg: RankFilterConfig) -> dict[str, Any]:
    preview_cfg = RankFilterConfig(**{**cfg.__dict__, "top_n": 0})
    _, stats = rank_with_filters(preview_cfg)
    return stats


def get_filter_options() -> dict[str, Any]:
    criteria = load_criteria()
    preferred = criteria.get("tech_stack", {}).get("preferred", [])
    locations = criteria.get("location", {}).get("preferred_regions", [])
    return {
        "tech_options": preferred,
        "location_presets": locations
        + ["Philippines", "Metro Manila", "NCR", "Cebu", "Davao"],
        "experience_levels": [
            {"id": "any", "label": "Any experience level"},
            {"id": "fresh_grad", "label": "Fresh grad / no paid dev"},
            {"id": "has_work_exp", "label": "Has dev work experience"},
            {"id": "intern_only", "label": "Intern / OJT only"},
        ],
        "tier_options": [
            {"id": "tier_a", "label": "Tier A (junior ≤2yr)"},
            {"id": "tier_b", "label": "Tier B (fresh grad)"},
            {"id": "unknown", "label": "Unknown tier"},
        ],
        "gender_note": "Gender is estimated from CV/email text (pronouns, labels) — not guaranteed accurate.",
    }
