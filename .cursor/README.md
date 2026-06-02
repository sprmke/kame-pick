# Cursor tooling

Project-specific AI configuration for Job Applicants Analyzer.

## Rules (`.cursor/rules/`)

| Rule | Scope | Purpose |
|------|-------|---------|
| `project-overview.mdc` | Always | Stack, paths, dual-mode, dev commands |
| `privacy-pii.mdc` | Always | Secrets & candidate data handling |
| `migration-dual-mode.mdc` | server, web, supabase, docs | Don't break local workflow during cloud migration |
| `web-nextjs.mdc` | `web/**` | Next.js 16, Supabase SSR, API client |
| `python-server.mdc` | `server/**`, `scripts/**` | FastAPI layout & service patterns |
| `supabase-migrations.mdc` | `supabase/**` | RLS, tenancy, migration naming |
| `candidate-analysis.mdc` | `data/**` | Ranking workflow when touching applicant data |

Rules load automatically based on `alwaysApply` or open file globs.

## Skills (`.cursor/skills/`)

Invoke in chat by name or let the agent auto-detect from your request.

| Skill | When to use |
|-------|-------------|
| `analyze-job-candidates` | Rank applicants, review CVs, GitHub checks |
| `implement-cloud-module` | Phase 2–5 Supabase / `server/cloud/` work |
| `local-dev-workflow` | Start servers, sync Gmail, troubleshoot local mode |
| `supabase-project-setup` | Create Supabase project, apply migrations, env vars |
| `send-shortlist-emails` | Draft outreach to shortlisted candidates |

Example prompts:

- "Use analyze-job-candidates and rank my top 10"
- "Implement Phase 2 database layer" → triggers `implement-cloud-module`
- "Help me set up Supabase for this project"

## Hooks (`.cursor/hooks.json`)

| Event | Script | Behavior |
|-------|--------|----------|
| `sessionStart` | `session-context.sh` | Injects project context |
| `beforeShellExecution` | `block-secrets-git.sh` | Blocks/asks on risky `git add/commit/push` |
| `afterFileEdit` | `post-edit-cloud-reminder.sh` | Reminds to update module docs after cloud/migration edits |

Hooks require executable scripts. If hooks don't load after editing, restart Cursor.

```bash
chmod +x .cursor/hooks/*.sh
```

## Recommended MCP servers

Enable these in **Cursor Settings → MCP** (user-level or copy from `mcp.json.example`).

| MCP | Why for this project |
|-----|----------------------|
| **Supabase** | Apply migrations, list tables, RLS advisors, auth logs |
| **context7** | Up-to-date Next.js 16, Supabase SSR, FastAPI docs |
| **shadcn/ui** | Add UI components to `web/src/components/ui/` |
| **Playwright** | E2E tests for auth flows and candidate pages |
| **Vercel** | Deploy `web/` when ready for production |
| **chrome-devtools** | Debug local web UI |

Optional: **Neon** if you ever split Postgres away from Supabase (not current plan).

### Project MCP example

Copy and customize:

```bash
cp .cursor/mcp.json.example ~/.cursor/mcp.json
# or merge servers into your existing ~/.cursor/mcp.json
```

Authenticate Supabase MCP when prompted so migrations and advisors work.

## AGENTS.md files

| Path | Audience |
|------|----------|
| `/AGENTS.md` | Root agent instructions (architecture, constraints) |
| `web/AGENTS.md` | Next.js 16-specific warnings (auto-generated block) |

## Adding more tooling

- **New rule:** `.cursor/rules/my-rule.mdc` with YAML frontmatter
- **New skill:** `.cursor/skills/my-skill/SKILL.md` — keep under 500 lines
- **New hook:** add script under `.cursor/hooks/` and register in `hooks.json`

See Cursor docs for hooks events: `beforeShellExecution`, `afterFileEdit`, `preToolUse`, etc.
