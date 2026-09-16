# Database schema

Drizzle schema: `src/db/schema.ts`. SQL: `supabase/migrations/`.

| Table | Purpose |
|-------|---------|
| `job_criteria` | Per-org YAML rubric |
| `candidate_notes` | Pipeline status, starred, notes, tags |
| `analysis_runs` | Saved ranking reports |
| `sync_jobs` | Gmail sync job status |
| `github_cache` | GitHub profile cache |
| `email_messages` | Outreach + inbound records |

All tenant tables have `organization_id` and RLS. Access goes through `src/server/*` + `requireOrgContext()`.
