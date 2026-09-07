"""Request context for local vs cloud store delegation."""

from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass

from fastapi import HTTPException, Request

from server.cloud.auth import AuthContext, auth_from_request
from server.cloud.config import is_cloud_mode


@dataclass(frozen=True)
class RequestContext:
    mode: str  # "local" | "cloud"
    organization_id: str | None = None
    user_id: str | None = None
    email: str | None = None
    org_role: str | None = None

    @property
    def is_cloud(self) -> bool:
        return self.mode == "cloud" and self.organization_id is not None

    def require_org(self) -> str:
        if not self.organization_id:
            raise HTTPException(status_code=403, detail="Organization context required")
        return self.organization_id


_current_ctx: ContextVar[RequestContext | None] = ContextVar("request_context", default=None)


def get_current_context() -> RequestContext:
    ctx = _current_ctx.get()
    if ctx is None:
        return RequestContext(mode="local")
    return ctx


def set_current_context(ctx: RequestContext) -> None:
    _current_ctx.set(ctx)


def build_context(request: Request) -> RequestContext:
    if not is_cloud_mode():
        return RequestContext(mode="local")
    path = request.url.path
    if path.endswith("/health") or path == "/api/health":
        return RequestContext(mode="local")
    auth: AuthContext = auth_from_request(request)
    return RequestContext(
        mode="cloud",
        organization_id=auth.organization_id,
        user_id=auth.user_id,
        email=auth.email,
        org_role=auth.org_role,
    )
