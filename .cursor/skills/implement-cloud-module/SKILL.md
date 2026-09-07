---
name: implement-cloud-module
description: >-
  Implements a phased cloud migration module for Kame Pick.
  Use when building Supabase features, server/cloud/ code, Phase 2–5 work,
  multi-tenant Postgres, or extending auth beyond login/signup.
---

# Implement Cloud Module

Follow this workflow when adding cloud functionality without breaking local mode.

## Before coding

1. Read `docs/migration-roadmap.md` — identify the current phase
2. Read the matching `docs/modules/NN-*.md` spec
3. Confirm: **do not modify or delete** local-only code (`server/db.py`, Gmail CLI, filesystem candidates) until Phase 6

## Implementation checklist

```
- [ ] Module doc exists or is updated in docs/modules/
- [ ] SQL migration in supabase/migrations/ (if schema change)
- [ ] RLS policies on new tenant tables
- [ ] New logic in server/cloud/ (not rewriting server/db.py)
- [ ] Routes feature-flag: cloud when authenticated + configured, else local
- [ ] Web UI works with Supabase env vars unset (local mode)
- [ ] TypeScript types in web/src/lib/api.ts if new endpoints
- [ ] Changelog row added to module doc
```

## File placement

| Concern | Location |
|---------|----------|
| Postgres schema | `supabase/migrations/` |
| Cloud repositories | `server/cloud/` |
| Auth middleware (API) | `server/cloud/auth.py` (when added) |
| Supabase clients (web) | `web/src/lib/supabase/` |
| Env detection | `web/src/lib/supabase/config.ts` → `isCloudMode` |

## RLS pattern

Every tenant table: `organization_id` + membership policy. See `.cursor/rules/supabase-migrations.mdc`.

## Testing both modes

**Local:** unset `NEXT_PUBLIC_SUPABASE_*`, run `npm run dev`, verify dashboard works without login.

**Cloud:** set Supabase vars in `web/.env.local`, apply migration, test login → protected routes.

## When stuck

- Architecture: `docs/architecture.md`
- Auth setup: `docs/modules/01-foundation-and-auth.md`
- Planned schema: `docs/modules/02-database-schema.md`
