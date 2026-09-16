# Cursor tooling

Project-specific AI configuration for Kame Pick.

## Rules (`.cursor/rules/`)

| Rule | Scope | Purpose |
|------|-------|---------|
| `project-overview.mdc` | Always | Stack, paths, dev commands |
| `privacy-pii.mdc` | Always | Secrets & candidate data handling |
| `supabase-migrations.mdc` | `supabase/**` | RLS, tenancy, migration naming |
| `candidate-analysis.mdc` | `data/**` | Ranking workflow when touching applicant data |

## Skills (`.cursor/skills/`)

| Skill | When to use |
|-------|-------------|
| `analyze-job-candidates` | Rank applicants, review CVs, GitHub checks |
| `supabase-project-setup` | Create Supabase project, apply migrations, env vars |
| `send-shortlist-emails` | Draft outreach to shortlisted candidates |

## Hooks (`.cursor/hooks.json`)

| Event | Script | Behavior |
|-------|--------|----------|
| `sessionStart` | `session-context.sh` | Injects project context |
| `beforeShellExecution` | `block-secrets-git.sh` | Blocks/asks on risky `git add/commit/push` |
| `afterFileEdit` | `post-edit-cloud-reminder.sh` | Reminds to update docs after migration edits |

## AGENTS.md

Root [`/AGENTS.md`](../AGENTS.md) — architecture, constraints, skill index.
