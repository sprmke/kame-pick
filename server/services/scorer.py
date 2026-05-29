"""Heuristic candidate scoring based on job-criteria.yaml and scoring rubric."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

import yaml

from server.config import JOB_CRITERIA_PATH
from server.services.candidates import get_combined_text_for_scoring, load_links, load_manifest


@dataclass
class ScoreBreakdown:
    experience_tier: str = "unknown"
    experience_years: float | None = None
    filipino_verified: bool = False
    filipino_signals: list[str] = field(default_factory=list)
    auto_pass: bool = False
    auto_pass_reason: str | None = None
    tech_stack_score: int = 0
    tech_required_met: list[str] = field(default_factory=list)
    tech_preferred_met: list[str] = field(default_factory=list)
    git_score: int = 0
    git_evidence: str = ""
    honors_score: int = 0
    honors_found: list[str] = field(default_factory=list)
    ai_tools_score: int = 0
    ai_tools_found: list[str] = field(default_factory=list)
    location_score: int = 0
    location_signals: list[str] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)
    total_score: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "experience_tier": self.experience_tier,
            "experience_years": self.experience_years,
            "filipino_verified": self.filipino_verified,
            "filipino_signals": self.filipino_signals,
            "auto_pass": self.auto_pass,
            "auto_pass_reason": self.auto_pass_reason,
            "tech_stack_score": self.tech_stack_score,
            "tech_required_met": self.tech_required_met,
            "tech_preferred_met": self.tech_preferred_met,
            "git_score": self.git_score,
            "git_evidence": self.git_evidence,
            "honors_score": self.honors_score,
            "honors_found": self.honors_found,
            "ai_tools_score": self.ai_tools_score,
            "ai_tools_found": self.ai_tools_found,
            "location_score": self.location_score,
            "location_signals": self.location_signals,
            "red_flags": self.red_flags,
            "total_score": self.total_score,
        }


def load_criteria() -> dict[str, Any]:
    if not JOB_CRITERIA_PATH.exists():
        return {}
    return yaml.safe_load(JOB_CRITERIA_PATH.read_text(encoding="utf-8")) or {}


def _contains_any(text: str, keywords: list[str]) -> list[str]:
    found = []
    for kw in keywords:
        if kw.lower() in text:
            found.append(kw)
    return found


def _estimate_experience_years(text: str) -> float | None:
    patterns = [
        (r"(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?(?:experience|exp)", 1.0),
        (r"(\d+(?:\.\d+)?)\s*\+?\s*yrs?\s+(?:of\s+)?(?:experience|exp)", 1.0),
        (r"(\d+)\s*\+?\s*years?\s+(?:as|in)\s+(?:a\s+)?(?:web|software|full[\s-]?stack|frontend|backend|developer)", 1.0),
        (r"(\d+)\s*\+?\s*years?\s+working", 1.0),
        (r"(\d+)\s*months?\s+(?:of\s+)?(?:experience|internship|intern)", 1 / 12),
    ]
    years: list[float] = []
    for pattern, mult in patterns:
        for m in re.finditer(pattern, text, re.I):
            try:
                years.append(float(m.group(1)) * mult)
            except ValueError:
                pass
    if re.search(r"fresh\s+grad|new\s+grad|recent\s+grad|no\s+professional\s+experience|0\s+years?", text, re.I):
        years.append(0.0)
    if re.search(r"intern(?:ship)?|ojt|on[\s-]?the[\s-]?job\s+training", text, re.I) and not years:
        years.append(0.25)
    return max(years) if years else None


def _check_filipino(text: str, criteria: dict) -> tuple[bool, list[str]]:
    signals_cfg = criteria.get("filipino_signals", {})
    signals: list[str] = []

    ph_patterns = [
        r"philippines",
        r"\bph\b",
        r"pampanga",
        r"region\s*iii",
        r"central\s+luzon",
        r"metro\s+manila",
        r"\bncr\b",
        r"\+63",
        r"\b09\d{9}\b",
        r"angeles\s+city",
        r"san\s+fernando",
        r"clark",
        r"cebu",
        r"davao",
    ]
    for p in ph_patterns:
        if re.search(p, text, re.I):
            signals.append(p.replace("\\b", "").replace("\\s+", " "))

    for school in signals_cfg.get("schools", []):
        if school.lower() in text:
            signals.append(f"school:{school}")

    for loc in signals_cfg.get("location_keywords", []):
        if loc.lower() in text:
            signals.append(f"location:{loc}")

    return len(signals) >= 2, signals[:8]


def _score_tech(text: str, criteria: dict) -> tuple[int, list[str], list[str]]:
    required_map = {
        "programming": ["programming", "software development", "web development", "developer"],
        "git": ["git", "github", "gitlab", "bitbucket", "version control"],
        "editor": criteria.get("editor_signals", ["vscode", "vs code", "cursor"]),
        "ai_tools": [s.lower() for s in criteria.get("ai_tools_signals", [])[:12]],
        "english": [],  # qualitative — give partial if text is substantial
    }
    preferred = criteria.get("tech_stack", {}).get("preferred", [])
    preferred_keywords = []
    for item in preferred:
        preferred_keywords.extend(item.lower().split())

    required_met: list[str] = []
    if _contains_any(text, required_map["programming"]):
        required_met.append("programming/web basics")
    if _contains_any(text, required_map["git"]):
        required_met.append("git fundamentals")
    if _contains_any(text, [e.lower() for e in required_map["editor"]]):
        required_met.append("VS Code / Cursor")
    ai_found = _contains_any(text, required_map["ai_tools"])
    if ai_found:
        required_met.append("AI coding tools")
    if len(text) > 400:
        required_met.append("written communication (CV present)")

    preferred_met = _contains_any(text, [p for p in preferred_keywords if len(p) > 2])

    raw = len(required_met) * 8 + len(preferred_met) * 3
    return min(30, raw), required_met, preferred_met


def _score_git(text: str, slug: str) -> tuple[int, str]:
    links = load_links(slug)
    github = links.get("github", [])
    git_mentions = bool(re.search(r"\bgit\b|github|gitlab", text, re.I))

    if github:
        return 15, f"GitHub: {github[0]}"
    if git_mentions:
        return 5, "Git mentioned on CV/email"
    if links.get("portfolio_and_other"):
        return 8, "Portfolio link (no GitHub)"
    return 0, "No Git/GitHub evidence"


def _score_honors(text: str, criteria: dict) -> tuple[int, list[str]]:
    keywords = criteria.get("honors_keywords", [])
    found = _contains_any(text, [k.lower() for k in keywords])
    if not found:
        return 0, []
    return min(15, 10 + len(found) * 2), found


def _score_ai(text: str, criteria: dict) -> tuple[int, list[str]]:
    signals = [s.lower() for s in criteria.get("ai_tools_signals", [])]
    found = _contains_any(text, signals)
    extra = _contains_any(text, ["ai-assisted", "ai assisted", "vibe coding", "built with cursor"])
    found = list(dict.fromkeys(found + extra))
    if not found:
        return 0, []
    return min(12, 4 + len(found) * 2), found


def _score_location(text: str, criteria: dict) -> tuple[int, list[str]]:
    preferred = criteria.get("location", {}).get("preferred_regions", [])
    found = _contains_any(text, [r.lower() for r in preferred])
    if found:
        return 3, found
    if "philippines" in text or "pampanga" in text:
        return 1, ["Philippines"]
    return 0, []


def score_candidate(slug: str, criteria: dict | None = None) -> ScoreBreakdown:
    criteria = criteria or load_criteria()
    weights = criteria.get("ranking", {}).get("weights", {})
    text = get_combined_text_for_scoring(slug)
    breakdown = ScoreBreakdown()

    filipino_ok, fil_signals = _check_filipino(text, criteria)
    breakdown.filipino_verified = filipino_ok
    breakdown.filipino_signals = fil_signals

    years = _estimate_experience_years(text)
    breakdown.experience_years = years

    auto_pass_min = criteria.get("experience_tiers", {}).get("auto_pass", {}).get("min_years", 2)
    senior_patterns = [
        r"senior\s+(?:web|software|full[\s-]?stack)?\s*developer",
        r"lead\s+developer",
        r"(\d+)\s*\+?\s*years?\s+(?:of\s+)?(?:professional\s+)?experience",
    ]
    if years is not None and years > auto_pass_min:
        breakdown.auto_pass = True
        breakdown.auto_pass_reason = f">{auto_pass_min} years experience detected ({years:.1f}y)"
        breakdown.experience_tier = "auto_pass"
    elif re.search(r"senior|lead developer|principal engineer", text, re.I):
        breakdown.auto_pass = True
        breakdown.auto_pass_reason = "Senior/lead title detected"
        breakdown.experience_tier = "auto_pass"
    elif years is not None and 0 < years <= 2:
        breakdown.experience_tier = "tier_a"
    elif years == 0 or re.search(r"fresh\s+grad|new\s+grad|student|ojt|intern", text, re.I):
        breakdown.experience_tier = "tier_b"
    else:
        breakdown.experience_tier = "unknown"

    tech_score, req_met, pref_met = _score_tech(text, criteria)
    breakdown.tech_stack_score = tech_score
    breakdown.tech_required_met = req_met
    breakdown.tech_preferred_met = pref_met

    git_score, git_ev = _score_git(text, slug)
    breakdown.git_score = git_score
    breakdown.git_evidence = git_ev

    honors_score, honors = _score_honors(text, criteria)
    breakdown.honors_score = honors_score
    breakdown.honors_found = honors

    ai_score, ai_found = _score_ai(text, criteria)
    breakdown.ai_tools_score = ai_score
    breakdown.ai_tools_found = ai_found

    loc_score, loc_sig = _score_location(text, criteria)
    breakdown.location_score = loc_score
    breakdown.location_signals = loc_sig

    if not filipino_ok:
        breakdown.red_flags.append("Filipino/PH location unverified (<2 signals)")
    if git_score == 0:
        breakdown.red_flags.append("No Git/GitHub evidence")
    if not req_met:
        breakdown.red_flags.append("Missing required skill signals")

    # Weighted total (scale component scores to weights max)
    exp_weight = weights.get("experience_tier", 20)
    tier_mult = {"tier_a": 1.0, "tier_b": 0.85, "unknown": 0.5, "auto_pass": 0}.get(
        breakdown.experience_tier, 0.5
    )
    exp_pts = int(exp_weight * tier_mult)

    total = (
        exp_pts
        + int(breakdown.tech_stack_score * weights.get("tech_stack_match", 30) / 30)
        + int(breakdown.git_score * weights.get("git_evidence", 15) / 15)
        + int(breakdown.honors_score * weights.get("education_honors", 15) / 15)
        + int(breakdown.ai_tools_score * weights.get("ai_tool_usage", 12) / 12)
        + breakdown.location_score
    )
    breakdown.total_score = min(100, total)
    return breakdown


def rank_all_candidates(
    *,
    filipino_only: bool = True,
    exclude_auto_pass: bool = True,
    max_dev_years: float | None = 2.0,
    top_n: int = 10,
    filter_config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    from server.services.filters import RankFilterConfig, rank_with_filters

    if filter_config is not None:
        cfg = RankFilterConfig.from_dict(filter_config)
        ranked, _ = rank_with_filters(cfg)
        return ranked

    cfg = RankFilterConfig(
        filipino_only=filipino_only,
        exclude_auto_pass=exclude_auto_pass,
        max_dev_years=max_dev_years,
        top_n=top_n,
    )
    ranked, _ = rank_with_filters(cfg)
    return ranked
