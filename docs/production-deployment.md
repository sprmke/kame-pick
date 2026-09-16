# Production deployment

Deploy as a **single TanStack Start app** on Vercel. Supabase hosts Postgres, Auth, and Storage.

## Architecture

| Service | Host |
|---------|------|
| App | [Vercel](https://vercel.com) |
| Database + Auth + Storage | [Supabase](https://supabase.com) |

## 1. Supabase

1. Create a production project.
2. Apply migrations: `supabase db push` or SQL Editor (files in `supabase/migrations/`).
3. Copy API keys and pooler `DATABASE_URL` into Vercel env vars.
4. Auth redirect: `https://your-app.vercel.app/auth/callback`

## 2. Vercel

1. Connect repo (root directory = repo root).
2. Framework: TanStack Start (`vercel.json`).
3. Set all vars from `.env.example` (including `VITE_SUPABASE_*`).
4. Gmail OAuth redirect: `https://your-app.vercel.app/api/gmail/callback`

## 3. Google OAuth (Gmail)

1. Gmail API enabled in Google Cloud Console.
2. Web application OAuth client.
3. Redirect URI: `https://your-app.vercel.app/api/gmail/callback`

## Env checklist

| Variable | Where |
|----------|-------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Vercel (same values) |
| `DATABASE_URL` | Vercel (pooler URI) |
| `GOOGLE_OAUTH_*`, `TOKEN_ENCRYPTION_KEY` | Vercel |
| `GITHUB_TOKEN`, `GMAIL_QUERY` | Vercel (optional) |

Never expose `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` to the client bundle.
