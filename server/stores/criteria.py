"""Unified job criteria store."""

from __future__ import annotations

from typing import Any

import yaml

from server.cloud import criteria as cloud_criteria
from server.config import JOB_CRITERIA_PATH, ROOT
from server.services.scorer import _load_criteria_from_file as load_local_criteria
from server.stores.context import get_current_context


def load_criteria() -> dict[str, Any]:
    ctx = get_current_context()
    if ctx.is_cloud:
        return cloud_criteria.get_job_criteria(ctx.require_org())
    return load_local_criteria()


def get_job_criteria_response() -> dict[str, Any]:
    ctx = get_current_context()
    if ctx.is_cloud:
        org_id = ctx.require_org()
        return {
            "path": f"cloud://job_criteria/{org_id}",
            "parsed": cloud_criteria.get_job_criteria(org_id),
            "raw": cloud_criteria.get_job_criteria_raw(org_id),
        }
    if not JOB_CRITERIA_PATH.exists():
        return {"path": "", "parsed": {}, "raw": ""}
    return {
        "path": str(JOB_CRITERIA_PATH.relative_to(ROOT)),
        "parsed": load_local_criteria(),
        "raw": JOB_CRITERIA_PATH.read_text(encoding="utf-8"),
    }


def save_job_criteria(content: str) -> None:
    yaml.safe_load(content)
    ctx = get_current_context()
    if ctx.is_cloud:
        cloud_criteria.save_job_criteria(ctx.require_org(), content)
    else:
        JOB_CRITERIA_PATH.write_text(content, encoding="utf-8")
