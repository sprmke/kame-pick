# Module 01 — Foundation & auth

**Status:** Code complete — pending Supabase project setup  
**Phase:** 1

## Purpose

Introduce Supabase Auth and multi-tenant organization scaffolding without changing the existing local FastAPI + SQLite + filesystem workflow.

## Scope

### New files

| Path | Role |
|------|------|
| `supabase/migrations/20260530100000_foundation.sql` | Postgres schema + RLS |
| `web/src/lib/supabase/client.ts` | Browser Supabase client |
| `web/src/lib/supabase/server.ts` | Server Component / Route Handler client |
| `web/src/lib/supabase/middleware.ts` | Session refresh helper |
| `web/src/lib/supabase/config.ts` | Env detection (`isCloudMode`) |
| `web/src/middleware.ts` | Optional auth gate |
| `web/src/app/login/page.tsx` | Login page |
| `web/src/app/signup/page.tsx` | Signup page |
| `web/src/app/auth/callback/route.ts` | OAuth / email confirm callback |
| `web/src/app/auth/signout/route.ts` | Sign out |
| `web/src/components/app-shell.tsx` | Layout wrapper (hides sidebar on auth pages) |
| `web/src/components/user-menu.tsx` | Account menu in sidebar |
| `server/cloud/` | Placeholder for future cloud DB layer |

### Unchanged (preserved)

- All existing pages under `web/src/app/` (dashboard, candidates, etc.)
- `server/db.py`, `server/api/routes.py`, `data/candidates/`
- Local `npm run dev` when Supabase env vars are unset

## Operating modes

### Local mode (default)

No `NEXT_PUBLIC_SUPABASE_URL` → middleware is a no-op; no login required.

### Cloud mode

Supabase env vars set → unauthenticated users redirected to `/login`.

## Environment variables

Add to `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional (server-only, for future FastAPI JWT validation):

```env
SUPABASE_JWT_SECRET=your-jwt-secret
```

## Database schema

### Tables

- **`profiles`** — extends `auth.users` (display name)
- **`organizations`** — workspace / hiring team
- **`organization_members`** — user ↔ org with role

### Roles

| Role | Capabilities (future) |
|------|----------------------|
| `owner` | Full access, billing, delete org |
| `admin` | Manage members, settings |
| `member` | View/edit candidates |

### Signup flow

1. User signs up via `/signup`
2. Trigger `on_auth_user_created` creates profile + default organization + owner membership

## Setup (one-time)

1. Create a [Supabase project](https://supabase.com/dashboard)
2. Run the migration:
   - **Dashboard:** SQL Editor → paste `supabase/migrations/20260530100000_foundation.sql`
   - **CLI:** `supabase link` then `supabase db push`
3. Copy project URL + anon key to `web/.env.local`
4. (Optional) Enable Google provider under Authentication → Providers
5. Add redirect URL: `http://localhost:3000/auth/callback`

## Testing

### Local mode

```bash
# Ensure Supabase vars are NOT in web/.env.local
npm run dev
# Visit http://localhost:3000 — should load dashboard without login
```

### Cloud mode

```bash
# With Supabase vars set
npm run dev
# Visit http://localhost:3000 — redirects to /login
# Sign up → redirected to dashboard with user menu
```

## Changelog

| Date | Change |
|------|--------|
| 2026-05-30 | Initial foundation: docs, migration SQL, Supabase SSR, auth pages, optional middleware |
