---
name: local-dev-workflow
description: >-
  Runs the Job Applicants Analyzer locally — web, API, Gmail sync, and PDF
  extraction. Use when starting dev servers, syncing applicants, setting up
  the project, or troubleshooting local mode.
---

# Local Dev Workflow

## First-time setup

```bash
cd /Users/michaelmanlulu/Projects/personal-projects/job-applicants-analyzer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-server.txt
cp .env.example .env          # edit GMAIL_QUERY
cd web && npm install && cp .env.local.example .env.local
cd .. && npm install
```

Gmail OAuth (one-time): download Desktop OAuth JSON → `credentials.json`. See root README.

## Run dev servers

```bash
source .venv/bin/activate
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:8000/api/health

## Sync new applicants

```bash
source .venv/bin/activate
python scripts/fetch_emails.py --only-new
python scripts/extract_resume_text.py
```

Or use the **Gmail Sync** page in the web UI.

## Local vs cloud mode

| Mode | Condition |
|------|-----------|
| Local | `NEXT_PUBLIC_SUPABASE_URL` unset in `web/.env.local` |
| Cloud | Supabase URL + anon key set → login required |

Local mode must always work without Supabase.

## Common issues

| Symptom | Fix |
|---------|-----|
| API connection refused | Ensure `npm run dev` or uvicorn on :8000 |
| Empty candidates | Run `fetch_emails.py` first |
| Token expired | Delete `token.json`, re-run fetch |
| Empty PDF text | Scanned PDF — needs OCR or visual review |

## Docs

- `docs/local-development.md`
- `docs/architecture.md`
