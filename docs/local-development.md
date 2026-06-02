# Local development (unchanged)

The original single-user workflow still works exactly as before. Cloud env vars are **optional**.

## Prerequisites

- Python 3.11+
- Node.js 20+
- Gmail OAuth setup (see root [README](../README.md))

## Run web + API

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-server.txt
cd web && npm install && cp .env.local.example .env.local
cd .. && npm install
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:8000/api/health

## Local mode vs cloud mode

| Variable | Local mode | Cloud mode |
|----------|------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | unset | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | unset | Supabase anon key |

When Supabase vars are **unset**, the app skips auth middleware and behaves as the original local dashboard.

When set, unauthenticated users are redirected to `/login` (except auth routes).

### Cloud mode (API)

Set on the **API** (root `.env` or `.env.local`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase Postgres connection string |
| `SUPABASE_JWT_SECRET` | Validate Bearer tokens from web |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads |
| `SUPABASE_URL` | Storage API base URL |

Optional for Gmail sync in cloud: `GOOGLE_OAUTH_*`, `TOKEN_ENCRYPTION_KEY`. See [production-deployment.md](./production-deployment.md).

## Fetch applicants (CLI — unchanged)

```bash
source .venv/bin/activate
python scripts/fetch_emails.py --only-new
python scripts/extract_resume_text.py
```

## Data locations

| Data | Path |
|------|------|
| Candidates | `data/candidates/` |
| Recruiter notes | `data/app.db` (SQLite) |
| Job criteria | `config/job-criteria.yaml` |
| Gmail token | `token.json` (project root) |
