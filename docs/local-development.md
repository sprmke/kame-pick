# Local development

## Prerequisites

- [Bun](https://bun.sh/) (or Node.js 20+)
- Supabase project with migrations applied
- `.env.local` from `.env.example`

## Run

```bash
bun install
bun run dev
```

Open http://localhost:3000 → sign up → dashboard.

## Environment

Copy `.env.example` → `.env.local`. Required:

| Variable | Notes |
|----------|-------|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Same project URL |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | Same anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `DATABASE_URL` | Supabase **pooler** URI (recommended) |

Apply migrations:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Gmail sync

1. Connect Gmail in **Settings**
2. Run sync from **Sync** page (`/sync`)

Requires `GOOGLE_OAUTH_*` and `TOKEN_ENCRYPTION_KEY` in `.env.local`.

## Import legacy `./data/` (optional)

After signup:

```bash
bun run migrate:local
```

Auto-picks your org if `ORGANIZATION_ID` is unset and only one org exists.

## Supabase Auth redirects

Authentication → URL Configuration:

- `http://localhost:3000/auth/callback`
