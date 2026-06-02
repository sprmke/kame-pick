"""Per-organization job criteria in Postgres."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from server.cloud.pg import execute, fetch_one
from server.config import JOB_CRITERIA_PATH


def get_job_criteria(org_id: str) -> dict[str, Any]:
    row = fetch_one(
        "SELECT content FROM job_criteria WHERE organization_id = %s",
        (org_id,),
    )
    if row:
        return yaml.safe_load(row["content"]) or {}
    # Seed from local default on first access
    if JOB_CRITERIA_PATH.exists():
        return yaml.safe_load(JOB_CRITERIA_PATH.read_text(encoding="utf-8")) or {}
    return {}


def get_job_criteria_raw(org_id: str) -> str:
    row = fetch_one(
        "SELECT content FROM job_criteria WHERE organization_id = %s",
        (org_id,),
    )
    if row:
        return row["content"]
    if JOB_CRITERIA_PATH.exists():
        return JOB_CRITERIA_PATH.read_text(encoding="utf-8")
    return ""


def save_job_criteria(org_id: str, content: str) -> None:
    yaml.safe_load(content)  # validate
    execute(
        """
        INSERT INTO job_criteria (organization_id, content, updated_at)
        VALUES (%s, %s, now())
        ON CONFLICT (organization_id) DO UPDATE SET
            content = EXCLUDED.content,
            updated_at = now()
        """,
        (org_id, content),
    )
