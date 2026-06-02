# Migration roadmap

Phased delivery. **Do not remove** local implementations until each cloud module is finalized and tested.

## Phase 1 — Foundation & auth ✅

- [x] App documentation structure (`docs/`)
- [x] Supabase SQL migration (organizations, profiles, members, RLS)
- [x] Next.js Supabase SSR clients + optional auth middleware
- [x] Login / signup / callback / signout routes
- [x] Dual mode: local dev works without Supabase env vars
- [ ] **Manual:** Apply migration to a Supabase project
- [ ] **Manual:** Set `NEXT_PUBLIC_SUPABASE_*` in `web/.env.local`

**Module doc:** [01-foundation-and-auth](./modules/01-foundation-and-auth.md)

## Phase 2 — Cloud database layer ✅

- [x] `server/cloud/` Postgres repository (parallel to `server/db.py`)
- [x] Migrate SQLite tables to Postgres with `organization_id`
- [x] FastAPI JWT middleware (Supabase)
- [x] Store delegation: routes/services use cloud when authenticated + `DATABASE_URL` set
- [x] Per-org `job_criteria` in Postgres

**Module doc:** [02-database-schema](./modules/02-database-schema.md)

## Phase 3 — Candidate data in cloud ✅

- [x] Postgres `candidates` + Supabase Storage for PDFs
- [x] Import path from local `data/candidates/` (`POST /api/import/local`)
- [x] API routes serve cloud candidates alongside local (via store delegation)
- [x] Attachment proxy route in Next.js for authenticated PDF viewing

**Module doc:** [03-candidates-cloud](./modules/03-candidates-cloud.md)

## Phase 4 — Gmail OAuth (web) ✅

- [x] `gmail_connections` + OAuth state tables
- [x] Per-user encrypted token storage
- [x] Connect Gmail UI in Settings
- [x] Cloud sync service (fetch + extract in cloud)

**Module doc:** [04-gmail-oauth](./modules/04-gmail-oauth.md)

## Phase 5 — Production deploy ✅ (docs + config)

- [x] Deployment guide ([production-deployment.md](./production-deployment.md))
- [x] CORS env configuration
- [x] Env examples for API + web
- [ ] **Manual:** Deploy to Vercel + Railway/Fly
- [ ] **Optional:** Background job runner (Inngest) for long sync jobs

## Phase 6 — Cleanup (after finalize)

- [ ] Deprecate local-only paths (only when cloud is default)
- [ ] Remove duplicate code
- [ ] Single README workflow

> **Rule:** No cleanup or removal of existing code until Phase 6 is explicitly approved.
