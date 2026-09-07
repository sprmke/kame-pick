from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CandidateNoteUpdate(BaseModel):
    status: str | None = None
    starred: bool | None = None
    notes: str | None = None
    tags: list[str] | None = None


class RankRequest(BaseModel):
    report_name: str = "web-ranking"
    save_run: bool = True
    top_n: int = Field(default=10, ge=1, le=100)

    filipino_only: bool = True
    exclude_auto_pass: bool = True
    min_dev_years: float | None = None
    max_dev_years: float | None = 2.0
    experience_level: str = "any"
    has_github: bool | None = None
    min_github_repos: int | None = Field(default=None, ge=0)
    tech_any: list[str] = Field(default_factory=list)
    tech_all: list[str] = Field(default_factory=list)
    locations: list[str] = Field(default_factory=list)
    gender: str = "any"
    min_age: int | None = Field(default=None, ge=16, le=80)
    max_age: int | None = Field(default=None, ge=16, le=80)
    has_honors: bool | None = None
    has_ai_tools: bool | None = None
    min_score: int | None = Field(default=None, ge=0, le=100)
    tiers: list[str] = Field(default_factory=list)


class RankPreviewRequest(RankRequest):
    top_n: int = Field(default=10, ge=0, le=100)


class GithubRefreshRequest(BaseModel):
    force: bool = False
    background: bool = True
    slugs: list[str] | None = None


class SyncRequest(BaseModel):
    only_new: bool = True
    force: bool = False


class JobCriteriaUpdate(BaseModel):
    content: str


class SendEmailRequest(BaseModel):
    subject: str
    body: str
    analysis_run_id: int | None = None
    reply: bool = True


class BatchEmailRequest(BaseModel):
    slugs: list[str] = Field(min_length=1)
    subject: str
    body: str
    analysis_run_id: int | None = None
    reply: bool = True
