# Agent instructions

Job Applicants Analyzer — TanStack Start + Supabase cloud app.

## Before making changes

1. Read `docs/migration-roadmap.md` for historical context (migration is largely complete).
2. The **active app** is at the repo root (`src/`, `bun run dev`).
3. The legacy Next.js + FastAPI stack lives in `old-app/` — do not modify unless explicitly asked.
4. Cloud code uses Supabase Postgres + Drizzle; migrations go in `supabase/migrations/`.

## Architecture

```
src/ (TanStack Start) → Supabase Postgres + Storage
supabase/ (auth + RLS)
old-app/ (legacy web/ + server/ — archived)
data/ (local PII, gitignored)
```

## Common tasks → skills

| Task | Skill |
|------|-------|
| Rank / analyze applicants | `analyze-job-candidates` |
| Run legacy local dev | `local-dev-workflow` (old-app/) |
| Supabase setup | `supabase-project-setup` |
| Email shortlisted candidates | `send-shortlist-emails` |

## Dev

```bash
bun install
bun run dev
```

## Constraints

- Never commit PII (`data/candidates/`), secrets (`.env`, `token.json`), or credentials
- Summarize resumes in chat — don't dump full text
- All tenant Postgres tables need `organization_id` + RLS

## Cursor tooling

Full index: [.cursor/README.md](.cursor/README.md)
