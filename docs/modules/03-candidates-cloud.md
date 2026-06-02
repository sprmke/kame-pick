# Module 03 — Candidates (cloud storage)

**Status:** Code complete  
**Phase:** 3

## Purpose

Store candidate manifest data, emails, and PDF attachments in Postgres + Supabase Storage instead of `data/candidates/`.

## Tables

- `candidates` — manifest fields + metadata/links/email_text JSON
- `candidate_files` — attachment paths + extracted text
- `sync_state` — per-org Gmail processed message IDs

## Storage

Bucket: `candidate-files`  
Path pattern: `{organization_id}/{slug}/attachments/{filename}`

## API

Store delegation in `server/stores/candidates.py` — same function names as local `server/services/candidates.py`.

| Endpoint | Notes |
|----------|-------|
| `POST /api/import/local` | One-time migration from local filesystem |
| `GET /api/candidates/{slug}/attachment/{file}` | Serves bytes from Storage in cloud mode |

## Web

Cloud PDF viewing uses `/api/attachment/[slug]/[filename]` Next.js proxy (adds Bearer token).

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | Candidates table, Storage, import tool, attachment proxy |
