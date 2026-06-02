"""Cloud configuration (optional — local mode when unset)."""

from __future__ import annotations

import os


def is_cloud_mode() -> bool:
    return bool(get_database_url())


def get_database_url() -> str | None:
    return os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")


def get_supabase_url() -> str | None:
    return os.getenv("SUPABASE_URL")


def get_supabase_service_key() -> str | None:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def get_supabase_anon_key() -> str | None:
    return os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")


def get_encryption_key() -> str | None:
    return os.getenv("TOKEN_ENCRYPTION_KEY") or os.getenv("ENCRYPTION_KEY")


def get_google_oauth_client_id() -> str | None:
    return os.getenv("GOOGLE_OAUTH_CLIENT_ID")


def get_google_oauth_client_secret() -> str | None:
    return os.getenv("GOOGLE_OAUTH_CLIENT_SECRET")


def get_google_oauth_redirect_uri() -> str | None:
    return os.getenv("GOOGLE_OAUTH_REDIRECT_URI")


def get_cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    return [o.strip() for o in raw.split(",") if o.strip()]
