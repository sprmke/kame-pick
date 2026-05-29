---
name: analyze-job-candidates
description: >-
  Fetches and ranks job applicants from local candidate data. Use when the user
  asks to analyze resumes, rank candidates, fetch applicant emails, review CVs,
  check GitHub portfolios, or find top junior Filipino developers for hiring.
---

# Analyze Job Candidates

End-to-end workflow for this repo: sync Gmail → extract resumes → score → report top N.

## Prerequisites

1. User has run email sync at least once (see README).
2. Candidate data lives in `data/candidates/` (gitignored — contains PII).
3. Scoring rubric: [scoring-rubric.md](scoring-rubric.md)
4. Job config: [config/job-criteria.yaml](../../config/job-criteria.yaml)

## Step 1 — Sync new emails

```bash
cd /Users/michaelmanlulu/Projects/personal-projects/job-applicants-analyzer
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # first time only; edit GMAIL_QUERY
python scripts/fetch_emails.py --only-new
python scripts/extract_resume_text.py
```

Re-run `--only-new` anytime new applicants email in. Use `--force` to re-download everything.

## Step 2 — Load candidate index

Read `data/candidates/manifest.json` for the full list. For each candidate folder:

| File | Purpose |
|------|---------|
| `metadata.json` | sender, dates, links, attachments |
| `combined-email.txt` | full email thread text |
| `links.json` | GitHub, LinkedIn, portfolio URLs |
| `attachments/*.pdf` | resume/CV files |
| `extracted/*.txt` | PDF text (run extract script first) |

## Step 3 — Hard filters (apply first)

**Remove non-Filipino candidates.** Require at least one strong signal:

- Address/location in Philippines on CV or email
- Philippine mobile format (+63, 09xx)
- Philippine university or employer
- Explicitly states Filipino / based in PH

If unclear and no PH signals → **exclude** with reason "nationality/location unverified".

**Auto-pass (exclude from ranking):** more than 2 years professional dev experience (internships count at 0.5x if stated).

**Role:** AI-Assisted Web Developer — fresh grad, intern, or junior dev only (contract/freelance, remote/hybrid Pampanga, full-time 8 hrs/day).

## Step 4 — Experience tier (primary rank)

1. **Tier A (best):** ~1 to <2 years junior / intern dev experience
2. **Tier B:** fresh grad / no professional dev experience
3. **Tier C:** auto-pass (>2 years) — list separately, do not rank in top 10

## Step 5 — Score remaining candidates

Use weights from `config/job-criteria.yaml`. Bonus signals:

| Signal | Points guidance |
|--------|-----------------|
| Based in Pampanga / Region III | +10 |
| Cum laude / magna / dean's list / high honors | +10 |
| Tech stack match (required + preferred) | up to +25 |
| GitHub shows real repos, commits, branching | up to +15 |
| Built web apps with AI tools (Cursor, Claude Code, ChatGPT, vibe coding, etc.) | up to +10 |
| Portfolio / GitHub / sample projects present | qualitative — expected |
| Good written English in email + CV | qualitative tiebreaker |

**Git is mandatory.** No GitHub AND no Git mentions on CV → downgrade heavily or exclude.

**Required skills to verify:** programming/web basics, Git fundamentals, VS Code or Cursor, AI coding tools, written English.

## Step 6 — External verification (when links exist)

For each shortlisted candidate with GitHub URLs:

- Inspect repo count, recency, README quality, commit history
- Note if repos look like tutorials-only vs shipped projects
- Check portfolio links for live demos

Use browser or `gh` CLI if available. If a link is dead, note it — do not assume skills.

## Step 7 — Soft skills (role fit)

Prioritize candidates who appear:

- Fast learners (projects beyond coursework, self-taught stack)
- Strong written English and professional email tone
- Independent remote worker (self-directed projects, clear communication)
- Ship-oriented (deployed apps, live URLs, finished projects)
- AI-native workflow (mentions AI tools, vibe coding, or AI-assisted projects)
- Full-time available, good time management, attention to detail

## Output format

Save report to `data/reports/ranking-YYYY-MM-DD.md` and summarize in chat:

```markdown
# Candidate Ranking — [date]

## Summary
- Total synced: X
- After Filipino filter: Y
- Auto-pass (>2yr): Z

## Top 10

### 1. [Name] — Score XX/100 — Tier A
- **Email:** ...
- **Candidate folder:** `data/candidates/[slug]/`
- **CV (PDF):** `data/candidates/[slug]/attachments/[filename].pdf`
- **CV (text):** `data/candidates/[slug]/extracted/[filename].txt` (if extracted)
- **Location:** ...
- **Experience:** ...
- **Honors:** ...
- **Tech match:** ...
- **Git/GitHub:** ...
- **AI tools:** ...
- **Why:** 2-3 sentences
- **Risks / gaps:** ...

(repeat for 10)

## Excluded
| Name | Reason |

## Auto-pass (>2 years)
| Name | Years | Note |
```

## Privacy

- Never commit `data/candidates/`, `token.json`, or `credentials.json`
- Do not paste full resumes in chat — summarize
- Do not ask user to paste Gmail passwords in chat; OAuth via README

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No candidates folder | Run `fetch_emails.py` first |
| Empty PDF text | Scanned PDF — read attachment visually or OCR |
| Wrong emails fetched | Edit `GMAIL_QUERY` in `.env`; add Gmail label |
| Token expired | Delete `token.json`, re-run fetch (browser OAuth) |
