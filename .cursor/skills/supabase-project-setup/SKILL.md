---
name: supabase-project-setup
description: >-
  Sets up Supabase for Kame Pick — project creation, env vars, migration apply,
  and OAuth. Use when configuring Supabase, applying SQL migrations, or debugging
  login issues.
---

# Supabase Project Setup

## Prerequisites

- Supabase account at https://supabase.com
- Supabase CLI (recommended): `supabase login`

## Steps

### 1. Create project

Create a Supabase project. Note project ref, URL, and anon key.

### 2. Apply migrations

```bash
supabase link --project-ref <ref>
supabase db push
```

Or run each file in `supabase/migrations/` via SQL Editor (in order).

### 3. Configure `.env.local`

```bash
cp .env.example .env.local
```

Set server and client vars to the **same project**:

```env
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
DATABASE_URL=postgresql://postgres.<ref>:...@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Use the **pooler** URI for `DATABASE_URL` (direct `db.*` host can be IPv6-only).

### 4. Auth redirects

Supabase → Authentication → URL Configuration:

- `http://localhost:3000/auth/callback`
- Production: `https://your-app.vercel.app/auth/callback`

### 5. Verify

```bash
bun run dev
```

Visit http://localhost:3000 → sign up → dashboard with default org.

## Reference

- `docs/local-development.md`
- `docs/production-deployment.md`
