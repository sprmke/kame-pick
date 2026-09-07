"""Postgres connection pool for cloud mode."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from server.cloud.config import get_database_url, is_cloud_mode

_pool: ConnectionPool | None = None


def init_pool() -> None:
    global _pool
    if not is_cloud_mode():
        return
    url = get_database_url()
    if not url:
        raise RuntimeError("DATABASE_URL is required for cloud mode")
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=url,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
        )


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    if _pool is None:
        init_pool()
    if _pool is None:
        raise RuntimeError("Postgres pool is not initialized")
    with _pool.connection() as conn:
        yield conn


def fetch_one(query: str, params: tuple | dict | None = None) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(query, params or ()).fetchone()
        return dict(row) if row else None


def fetch_all(query: str, params: tuple | dict | None = None) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(query, params or ()).fetchall()
        return [dict(r) for r in rows]


def execute(query: str, params: tuple | dict | None = None) -> None:
    with get_conn() as conn:
        conn.execute(query, params or ())


def execute_returning(query: str, params: tuple | dict | None = None) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(query, params or ()).fetchone()
        return dict(row) if row else None
