# Production deployment

Deploy the **web** and **API** separately. Both need cloud env vars for multi-user mode.

## Architecture

| Service | Host | Env |
|---------|------|-----|
| Next.js (`web/`) | [Vercel](https://vercel.com) | `NEXT_PUBLIC_*`, Supabase keys |
| FastAPI (`server/`) | [Railway](https://railway.app) or [Fly.io](https://fly.io) | `DATABASE_URL`, JWT secret, Gmail OAuth |
| Database + Auth + Storage | [Supabase](https://supabase.com) | Migrations in `supabase/migrations/` |

## 1. Supabase setup

1. Create a Supabase project (prod + optional staging).
2. Apply all migrations in order via SQL Editor or `supabase db push`:
   - `20260530100000_foundation.sql`
   - `20260530110000_workflow_tables.sql`
   - `20260530120000_candidates_storage.sql`
   - `20260530130000_gmail_connections.sql`
   - `20260530140000_gmail_oauth_states.sql`
3. Copy from **Project Settings → API**:
   - Project URL → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (API only, never in web)
   - JWT secret → `SUPABASE_JWT_SECRET` (API only)
4. Copy **Database → Connection string** (URI, port 5432) → `DATABASE_URL` on API.
5. Add redirect URL in **Authentication → URL Configuration**:  
   `https://your-app.vercel.app/auth/callback`

## 2. Google OAuth (Gmail)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs → Gmail API enabled.
2. Create **Web application** OAuth client.
3. Authorized redirect URI:  
   `https://your-api.railway.app/api/gmail/oauth/callback`
4. Set on API:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`
5. Generate `TOKEN_ENCRYPTION_KEY` (Fernet key) for stored refresh tokens.

## 3. Deploy API (Railway example)

```bash
# railway.json or Dockerfile — start command:
uvicorn server.main:app --host 0.0.0.0 --port $PORT
```

Required env vars:

```
DATABASE_URL=
SUPABASE_URL=
SUPABASE_JWT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
TOKEN_ENCRYPTION_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
CORS_ORIGINS=https://your-app.vercel.app
GMAIL_QUERY=...
GITHUB_TOKEN=...
RECRUITER_TEAM_NAME=...
```

## 4. Deploy web (Vercel)

Root directory: `web/`

```
NEXT_PUBLIC_API_URL=https://your-api.railway.app/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## 5. Post-deploy checklist

- [ ] Sign up / login works
- [ ] Settings → Connect Gmail
- [ ] Sync → Full sync pulls applicants
- [ ] Candidates list loads; PDF preview works (via `/api/attachment` proxy)
- [ ] Rankings, notes, reports persist per org
- [ ] Shortlist emails send from connected Gmail

## Local + cloud dev

| Mode | Web env | API env |
|------|---------|---------|
| Local only | Supabase vars unset | `DATABASE_URL` unset |
| Cloud dev | Supabase vars set | `DATABASE_URL` + JWT secret set |

Local mode continues to work without any Supabase configuration.

## Staging

Use separate Supabase projects for staging and production. Never share `TOKEN_ENCRYPTION_KEY` or service role keys between environments.
