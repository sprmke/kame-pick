---
name: supabase-project-setup
description: >-
  Sets up Supabase for Kame Pick cloud mode — project creation,
  env vars, migration apply, and OAuth. Use when configuring Supabase, enabling
  cloud auth, applying SQL migrations, or debugging login issues.
---

# Supabase Project Setup

## Prerequisites

- Supabase account at https://supabase.com
- Supabase MCP enabled in Cursor (recommended) or Supabase CLI

## Steps

### 1. Create project

Create a new Supabase project. Note the project URL and anon key.

### 2. Apply foundation migration

Run SQL from `supabase/migrations/20260530100000_foundation.sql` via:
- Supabase dashboard → SQL Editor, or
- `supabase link` + `supabase db push` (if CLI configured)

Creates: `profiles`, `organizations`, `organization_members`, RLS, signup trigger.

### 3. Configure web env

Add to `web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional (future FastAPI JWT validation):

```env
SUPABASE_JWT_SECRET=your-jwt-secret
```

### 4. Optional — Google OAuth

Supabase dashboard → Authentication → Providers → Google.
Add redirect URL: `http://localhost:3000/auth/callback`

### 5. Verify

```bash
cd web && npm run dev
```

Visit http://localhost:3000 → should redirect to `/login`.
Sign up → should create profile + default organization.

## MCP tools (when available)

Use Supabase MCP for:
- `list_tables` — verify schema after migration
- `apply_migration` — apply new migrations in dev
- `get_advisors` — security/performance checks
- `get_logs` — debug auth errors

Load the Supabase agent skill for RLS and security guidance.

## Reference

- Module doc: `docs/modules/01-foundation-and-auth.md`
- Local fallback: unset Supabase env vars to return to local mode
