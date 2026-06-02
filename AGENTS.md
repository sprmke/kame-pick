# Agent instructions

Job Applicants Analyzer — local hiring tool migrating to multi-tenant cloud (Supabase).

## Before making changes

1. Read `docs/migration-roadmap.md` — know which phase is active
2. **Preserve local mode** — app must work without Supabase env vars
3. **Do not delete** `server/db.py`, Gmail scripts, or filesystem candidate code until Phase 6 approval
4. New cloud code → `server/cloud/` and `supabase/migrations/`

## Architecture (short)

```
web/ (Next.js 16)  →  server/ (FastAPI)  →  data/candidates/ + data/app.db
                    ↘  Supabase (auth + Postgres, phased)
```

## Common tasks → skills

| Task | Skill |
|------|-------|
| Rank / analyze applicants | `analyze-job-candidates` |
| Run dev + Gmail sync | `local-dev-workflow` |
| Build cloud features | `implement-cloud-module` |
| Set up Supabase | `supabase-project-setup` |
| Email shortlisted candidates | `send-shortlist-emails` |

## Dev

```bash
source .venv/bin/activate && npm run dev
```

## Constraints

- Never commit PII (`data/candidates/`), secrets (`.env`, `token.json`), or credentials
- Summarize resumes in chat — don't dump full text
- Next.js 16 has breaking changes — check `node_modules/next/dist/docs/` and use context7 MCP for current APIs
- All tenant Postgres tables need `organization_id` + RLS

## Cursor tooling

Full index: [.cursor/README.md](.cursor/README.md)
