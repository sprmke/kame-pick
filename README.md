# Job Applicants Analyzer

Fetch job applicant emails from Gmail, save resumes/links locally, and use Cursor AI to rank Filipino junior dev candidates.

## Quick start

### 1. Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2. Gmail OAuth setup (one-time)

Do **not** share your Gmail password in chat. Use Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → **APIs & Services** → **Enable APIs** → enable **Gmail API**
3. **OAuth consent screen** → External → add your email as test user
4. **Credentials** → **Create credentials** → **OAuth client ID** → **Desktop app**
5. Download JSON → save as `credentials.json` in this project root
6. (Recommended) In Gmail, create label `job-applicants` and filter applicant emails to it

Edit `.env`:

```env
GMAIL_QUERY=label:job-applicants
# or: subject:(application OR resume OR portfolio) has:attachment
```

### 3. Fetch emails

First run opens browser for Google sign-in:

```bash
python scripts/fetch_emails.py
python scripts/extract_resume_text.py
```

Incremental sync (new applicants only):

```bash
python scripts/fetch_emails.py --only-new
python scripts/extract_resume_text.py
```

### 4. Analyze with Cursor

In chat, say:

> Use the analyze-job-candidates skill and rank my top 10 applicants.

Or invoke: **analyze-job-candidates**

The agent reads `data/candidates/`, checks CVs, GitHub links, and writes `data/reports/ranking-*.md`.

## Folder layout

```
data/candidates/
  manifest.json              # index of all applicants
  juan-delacruz-at-gmail-com/
    metadata.json            # sender, links, attachment list
    combined-email.txt       # all email text
    links.json               # GitHub, portfolio URLs
    attachments/             # PDFs, etc.
    extracted/               # PDF text for AI
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/fetch_emails.py` | Sync Gmail → `data/candidates/` |
| `scripts/extract_resume_text.py` | PDF → text in `extracted/` |

### fetch_emails.py options

| Flag | Description |
|------|-------------|
| `--only-new` | Skip already-processed message IDs; use after date of last run |
| `--force` | Re-download processed messages |
| `--query "..."` | Override Gmail search query |
| `--after 2025/05/01` | Only emails after date |

## Customization

- **Tech stack & scoring:** edit `config/job-criteria.yaml`
- **Scoring details:** `.cursor/skills/analyze-job-candidates/scoring-rubric.md`
- **Gmail filter:** edit `GMAIL_QUERY` in `.env`

## Security

- `credentials.json`, `token.json`, `.env`, and `data/candidates/` are gitignored
- Candidate data stays on your machine
- Revoke access anytime: [Google Account permissions](https://myaccount.google.com/permissions)

## Re-run workflow

When new applicants email you:

```bash
source .venv/bin/activate
python scripts/fetch_emails.py --only-new
python scripts/extract_resume_text.py
```

Then ask Cursor to re-rank using the skill.

## Web application

Full-stack dashboard to browse applicants, run heuristic rankings, manage pipeline status, sync Gmail, and view reports.

### Install (web + API)

```bash
# Python (Gmail scripts + API)
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-server.txt

# Frontend
cd web && npm install && cp .env.local.example .env.local
cd .. && npm install   # root concurrently for `npm run dev`
```

### Run locally

```bash
source .venv/bin/activate
npm run dev
```

- **Web UI:** http://localhost:3000
- **API:** http://localhost:8000/api/health

Or run separately:

```bash
uvicorn server.main:app --reload --port 8000
cd web && npm run dev
```

### Web features

| Page | What it does |
|------|----------------|
| Dashboard | Applicant counts, pipeline stats, quick links |
| Candidates | Search, filter, sort by score; star & status tags |
| Candidate detail | Resume text, email, links, PDF download, score breakdown |
| Rank & Analyze | Edit job criteria YAML, save, then run top-N ranking |
| Rankings | Interactive top-N review with inline PDF resume preview |
| Gmail Sync | Trigger fetch + PDF extract from the UI |

Recruiter notes (status, stars, notes) are stored in `data/app.db` (local SQLite, gitignored).
