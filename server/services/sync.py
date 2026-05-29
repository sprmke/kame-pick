"""Run Gmail fetch and PDF extraction as background subprocess jobs."""

from __future__ import annotations

import subprocess
import sys
import threading
from pathlib import Path

from server.config import ROOT, SCRIPTS_DIR
from server.db import create_sync_job, finish_sync_job


def _sanitize_output(text: str) -> str:
    """Drop benign pdfminer noise; keep useful lines for the UI."""
    lines = []
    for line in text.splitlines():
        if "FontBBox" in line and "font descriptor" in line:
            continue
        if line.strip():
            lines.append(line)
    return "\n".join(lines).strip()


def _run_script(script_name: str, *args: str) -> tuple[int, str]:
    script = SCRIPTS_DIR / script_name
    python = sys.executable
    venv_python = ROOT / ".venv" / "bin" / "python"
    if venv_python.exists():
        python = str(venv_python)

    result = subprocess.run(
        [python, str(script), *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        timeout=600,
    )
    output = _sanitize_output((result.stdout or "") + (result.stderr or ""))
    return result.returncode, output[-4000:]


def run_fetch_emails(*, only_new: bool = True, force: bool = False) -> None:
    job_id = create_sync_job("fetch_emails")
    args: list[str] = []
    if only_new:
        args.append("--only-new")
    if force:
        args.append("--force")

    def _task() -> None:
        try:
            code, output = _run_script("fetch_emails.py", *args)
            status = "success" if code == 0 else "error"
            finish_sync_job(job_id, status, output or f"exit code {code}")
        except Exception as exc:  # noqa: BLE001
            finish_sync_job(job_id, "error", str(exc))

    threading.Thread(target=_task, daemon=True).start()


def run_extract_resumes(*, slug: str | None = None) -> None:
    job_id = create_sync_job("extract_resumes")
    args: list[str] = []
    if slug:
        args.extend(["--slug", slug])

    def _task() -> None:
        try:
            code, output = _run_script("extract_resume_text.py", "--quiet", *args)
            status = "success" if code == 0 else "error"
            finish_sync_job(job_id, status, output or f"exit code {code}")
        except Exception as exc:  # noqa: BLE001
            finish_sync_job(job_id, "error", str(exc))

    threading.Thread(target=_task, daemon=True).start()


def run_full_sync(*, only_new: bool = True) -> None:
    job_id = create_sync_job("full_sync")

    def _task() -> None:
        try:
            fetch_args = ["--only-new"] if only_new else []
            code1, out1 = _run_script("fetch_emails.py", *fetch_args)
            code2, out2 = _run_script("extract_resume_text.py", "--quiet")
            combined = f"Fetch:\n{out1}\n\nExtract:\n{out2}"
            if code1 == 0 and code2 == 0:
                finish_sync_job(job_id, "success", combined)
            else:
                finish_sync_job(job_id, "error", combined)
        except Exception as exc:  # noqa: BLE001
            finish_sync_job(job_id, "error", str(exc))

    threading.Thread(target=_task, daemon=True).start()
