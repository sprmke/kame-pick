# Architecture

## Overview

Job Applicants Analyzer is evolving from a **single-user local tool** into a **multi-tenant web application** while keeping the original implementation intact until the cloud path is finalized.

```mermaid
flowchart TB
  subgraph client [Browser]
    Web[Next.js 16 App]
  end

  subgraph local [Local mode — unchanged]
    API[FastAPI :8000]
    SQLite[(SQLite data/app.db)]
    FS[data/candidates/ filesystem]
    GmailLocal[token.json OAuth]
  end

  subgraph cloud [Cloud mode — phased in]
    SupaAuth[Supabase Auth]
    SupaDB[(Supabase Postgres)]
    SupaStore[Supabase Storage]
    Jobs[Background jobs — future]
  end

  Web -->|local API| API
  Web -->|session| SupaAuth
  API --> SQLite
  API --> FS
  API --> GmailLocal
  API -.->|future| SupaDB
  API -.->|future| SupaStore
  Jobs -.-> API
```

## Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Next.js 16, React 19, Tailwind 4 | Existing UI in `web/` |
| Backend | FastAPI (Python) | Existing API in `server/` |
| Local DB | SQLite | Recruiter notes, runs, email log |
| Local files | `data/candidates/` | Emails, PDFs, manifest |
| Cloud auth | Supabase Auth | Email/password + Google (optional) |
| Cloud DB | Supabase Postgres | Orgs, members, candidates (phased) |
| Cloud files | Supabase Storage | Resumes & attachments (phased) |
| Jobs | Inngest or Trigger.dev | Gmail sync workers (future) |
| Hosting | Vercel + Railway/Fly | Web + API (future) |

## Tenancy model

- **Organization** — hiring team / company workspace
- **Organization member** — user with role (`owner`, `admin`, `member`)
- All cloud data is scoped by `organization_id`
- Row Level Security (RLS) enforces isolation in Postgres

## API authentication (future)

FastAPI will validate Supabase JWTs and resolve `organization_id` from membership. Until wired, the existing API remains open on localhost (local mode).

## What stays local-only (for now)

These continue to use the original implementation:

- `scripts/fetch_emails.py` and `server/services/sync.py`
- `server/db.py` (SQLite)
- `server/services/candidates.py` (filesystem manifest)
- Desktop Gmail OAuth (`credentials.json`, `token.json`)

Cloud equivalents will be added as **new modules** under `server/cloud/` and documented separately.
