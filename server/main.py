"""FastAPI entrypoint for Job Applicants Analyzer web UI."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from server.api.routes import router
from server.cloud.config import get_cors_origins, is_cloud_mode
from server.cloud.pg import close_pool, init_pool
from server.db import init_db
from server.env import load_project_env
from server.stores.context import build_context, set_current_context

load_project_env()


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            ctx = build_context(request)
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        set_current_context(ctx)
        return await call_next(request)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    if is_cloud_mode():
        init_pool()
    yield
    close_pool()


app = FastAPI(
    title="Job Applicants Analyzer API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)

app.include_router(router, prefix="/api")
