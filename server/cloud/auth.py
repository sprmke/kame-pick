"""Supabase JWT validation and organization resolution."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import HTTPException, Request

from server.cloud.config import is_cloud_mode
from server.cloud.pg import fetch_all, fetch_one


@dataclass(frozen=True)
class AuthContext:
    user_id: str
    email: str | None
    organization_id: str
    org_role: str


def _jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET")
    if not secret:
        raise RuntimeError("SUPABASE_JWT_SECRET is required for cloud API auth")
    return secret


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            _jwt_secret(),
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


def resolve_organization_id(user_id: str, preferred_org_id: str | None = None) -> tuple[str, str]:
    """Return (organization_id, role) for the user."""
    if preferred_org_id:
        row = fetch_one(
            """
            SELECT organization_id, role::text AS role
            FROM organization_members
            WHERE user_id = %s AND organization_id = %s
            """,
            (user_id, preferred_org_id),
        )
        if row:
            return str(row["organization_id"]), row["role"]
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    row = fetch_one(
        """
        SELECT organization_id, role::text AS role
        FROM organization_members
        WHERE user_id = %s
        ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at
        LIMIT 1
        """,
        (user_id,),
    )
    if not row:
        raise HTTPException(status_code=403, detail="No organization membership found")
    return str(row["organization_id"]), row["role"]


def auth_from_request(request: Request) -> AuthContext:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth_header[7:].strip()
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    preferred_org = request.headers.get("X-Organization-Id")
    org_id, role = resolve_organization_id(user_id, preferred_org)
    return AuthContext(
        user_id=str(user_id),
        email=payload.get("email"),
        organization_id=org_id,
        org_role=role,
    )


def list_user_organizations(user_id: str) -> list[dict[str, Any]]:
    return fetch_all(
        """
        SELECT o.id, o.name, o.slug, om.role::text AS role
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id
        WHERE om.user_id = %s
        ORDER BY o.name
        """,
        (user_id,),
    )
