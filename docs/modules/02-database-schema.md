# Module 02 — Database schema (cloud)

**Status:** Code complete  
**Phase:** 2

## Purpose

Postgres tables mirroring SQLite workflow state, scoped by `organization_id`.

## Migration

`supabase/migrations/20260530110000_workflow_tables.sql`

## Tables

| Table | Local equivalent |
|-------|------------------|
| `job_criteria` | `config/job-criteria.yaml` |
| `candidate_notes` | SQLite `candidate_notes` |
| `analysis_runs` | SQLite `analysis_runs` |
| `sync_jobs` | SQLite `sync_jobs` |
| `github_cache` | SQLite `github_cache` (global) |
| `email_messages` | SQLite `email_messages` |

## Server code

| Path | Role |
|------|------|
| `server/cloud/pg.py` | Connection pool |
| `server/cloud/workflow_repo.py` | Postgres CRUD |
| `server/cloud/auth.py` | JWT validation + org resolution |
| `server/stores/workflow.py` | Local/cloud delegation |
| `server/stores/context.py` | Request context middleware |

## Auth

API reads `Authorization: Bearer <supabase_access_token>`. Resolves `organization_id` from `organization_members`.

Optional header: `X-Organization-Id` for multi-org switching.

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | Schema planning doc created |
| 2026-05-30 | Workflow tables migration + repos + JWT middleware |
