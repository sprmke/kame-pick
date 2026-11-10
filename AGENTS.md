# Agent instructions

Kame Pick — TanStack Start + Supabase full-stack app.

## Before making changes

1. The **active app** is at the repo root (`src/`, `bun run dev`).
2. Supabase Postgres + Drizzle; SQL migrations in `supabase/migrations/`.
3. Historical notes: `docs/migration-roadmap.md` (complete).

## Architecture

```
src/ (TanStack Start) → Supabase Postgres + Storage
supabase/ (auth + RLS)
data/ (local PII backup, gitignored — optional migrate:local source)
```

## Common tasks → skills

| Task | Skill |
|------|-------|
| Rank / analyze applicants | `analyze-job-candidates` |
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

<!-- global-agent-skills -->
## Global agent skills

This machine has 159 shared skills in `~/.agents/skill-library` (Claude Code, Cursor,
Codex and OpenCode all read them). Only five behaviour skills are always visible.
For anything else, open `~/.agents/skill-library/agent-skills-index/SKILL.md`, find the
skill that fits, then read `~/.agents/skill-library/<skill>/SKILL.md`.
Manage with `~/.agents/bin/agent-stack.sh`. Repo skills and rules always win.
