"""Load project environment variables (root .env + .env.local)."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent


def load_project_env() -> None:
    """Load `.env` then `.env.local` (local overrides). Matches common Next.js layout."""
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT / ".env.local", override=True)
