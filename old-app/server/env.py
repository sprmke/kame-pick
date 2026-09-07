"""Load project environment variables (root .env + .env.local)."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent


def load_project_env() -> None:
    """Load repo-root `.env` then `.env.local` (local overrides)."""
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(REPO_ROOT / ".env.local", override=True)
