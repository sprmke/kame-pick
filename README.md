# Kame Pick

**A multi-tenant hiring dashboard for syncing applicant emails, ranking candidates against job criteria, and managing your recruiting pipeline.**

Connect Gmail to pull in resumes, score applicants against a configurable YAML rubric, review PDFs and GitHub profiles, shortlist top talent, and send outreach — all in one workspace. Built with **TanStack Start**, **Supabase (Postgres + Auth + Storage)**, **Drizzle ORM**, and **Gmail OAuth**. Deploys to **Vercel** as a single full-stack app.

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#deploy-to-vercel">Deploy</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-Runtime-000?style=flat-square&logo=bun" alt="Bun" />
  <img src="https://img.shields.io/badge/TanStack_Start-Full--stack-000?style=flat-square" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-000?style=flat-square" alt="Drizzle" />
  <img src="https://img.shields.io/badge/Gmail-OAuth-4285F4?style=flat-square&logo=google" alt="Gmail OAuth" />
  <img src="https://img.shields.io/badge/Vercel-000?style=flat-square&logo=vercel" alt="Vercel" />
</p>

---

## Features

### Dashboard & pipeline

- **Organization-scoped workspace** — multi-tenant data with Supabase RLS
- **Dashboard overview** — total applicants, GitHub/resume counts, starred candidates, pipeline status
- **Candidate table** — search, filter by status/starred/GitHub, sort, pagination
- **Pipeline statuses** — new, shortlisted, interview, rejected, hired with notes and tags

### Gmail sync

- **Connect Gmail** via OAuth in Settings — encrypted refresh token storage
- **Fetch applicant emails** matching a configurable Gmail query
- **Extract resume PDFs** from attachments into Supabase Storage
- **Sync panel** — fetch, extract, or run a full sync from the UI

### Ranking & analysis

- **Job criteria editor** — YAML rubric (`config/job-criteria.yaml`) for role, tech stack, and scoring weights
- **Filter panel** — narrow the pool before ranking (location, experience, GitHub, etc.)
- **Preview & rank** — score candidates against criteria and save ranked reports
- **Reports** — browse and review past analysis runs

### Candidate profiles

- **Score breakdown** — weighted criteria match with detailed breakdown
- **Resume viewer** — in-browser PDF preview via authenticated proxy
- **GitHub insights** — repo activity and profile enrichment (optional `GITHUB_TOKEN`)
- **Link extraction** — GitHub, LinkedIn, and portfolio URLs from email/resume
- **Email outreach** — preview and send shortlist emails from templates; batch send support

### Authentication & settings

- **Sign up / sign in** via Supabase Auth (email + password)
- **Per-org job criteria** stored in Postgres
- **Gmail connection management** — connect, disconnect, sync status

### Legacy stack

The previous **Next.js + FastAPI** local stack is preserved in [`old-app/`](old-app/) for reference. See [`old-app/README.md`](old-app/README.md) for the original Gmail CLI and filesystem workflow.

---

## Tech Stack

| Layer              | Technology                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Runtime            | [Bun](https://bun.sh/)                                                                                          |
| Framework          | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)                   |
| UI                 | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide](https://lucide.dev/) icons |
| **Database**       | [Supabase Postgres](https://supabase.com/)                                                                      |
| **ORM**            | [Drizzle ORM](https://orm.drizzle.team/)                                                                        |
| **Auth & storage** | Supabase Auth + Storage (resumes & attachments)                                                                 |
| **Email sync**     | [Gmail API](https://developers.google.com/gmail/api) via [googleapis](https://www.npmjs.com/package/googleapis) |
| **PDF viewing**    | [react-pdf](https://www.npmjs.com/package/react-pdf) + pdfjs-dist                                               |
| **Hosting**        | [Vercel](https://vercel.com/) (Nitro preset)                                                                    |
| Config             | YAML job criteria + email templates in `config/`                                                                 |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- A [Supabase](https://supabase.com/) project
- [Google Cloud](https://console.cloud.google.com/) OAuth 2.0 **Web application** credentials (for Gmail sync)
- Optional: [GitHub token](https://github.com/settings/tokens) for repo insights

### 1. Clone and install

```bash
git clone https://github.com/sprmke/job-applicants-analyzer.git
cd job-applicants-analyzer
bun install
```

### 2. Supabase setup

1. Create a Supabase project.
2. Apply migrations:

   ```bash
   cd supabase
   supabase db push
   # or run each file from supabase/migrations/ in the SQL editor
   ```

3. Copy API keys from **Project Settings → API**.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable                       | Description                                              |
| ------------------------------ | -------------------------------------------------------- |
| `SUPABASE_URL`                 | Supabase project URL                                     |
| `SUPABASE_ANON_KEY`            | Supabase anon key (server)                               |
| `SUPABASE_SERVICE_ROLE_KEY`    | Service role key (server only — never expose to client)  |
| `DATABASE_URL`                 | Postgres connection string (port 5432, direct)           |
| `VITE_SUPABASE_URL`            | Same project URL (client)                                |
| `VITE_SUPABASE_ANON_KEY`       | Same anon key (client)                                   |
| `GOOGLE_OAUTH_CLIENT_ID`       | Google OAuth client ID (Web)                             |
| `GOOGLE_OAUTH_CLIENT_SECRET`   | Google OAuth client secret                               |
| `GOOGLE_OAUTH_REDIRECT_URI`    | `http://localhost:3000/api/gmail/callback`               |
| `TOKEN_ENCRYPTION_KEY`         | Fernet key for encrypted Gmail refresh tokens            |
| `GITHUB_TOKEN`                 | Optional — GitHub API rate limits                        |
| `GMAIL_QUERY`                  | Optional — Gmail search query for applicant emails       |
| `RECRUITER_TEAM_NAME`          | Optional — used in outreach email templates              |

See [`.env.example`](./.env.example) for the full list.

**Google OAuth setup**

1. Enable the Gmail API in Google Cloud Console.
2. Create OAuth credentials (Web application).
3. Add authorized redirect URI: `http://localhost:3000/api/gmail/callback` (and your production URL).
4. Paste client ID and secret into `.env.local`.

**Supabase Auth redirect**

Add to **Authentication → URL Configuration**:

- `http://localhost:3000/auth/callback`
- `https://your-app.vercel.app/auth/callback` (production)

### 4. Run locally

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) → sign up → dashboard.

### 5. Migrate existing local data (optional)

If you have data from the legacy local stack in `./data/`:

1. Sign up and copy your **organization UUID** from Supabase into `.env.local`:

   ```
   ORGANIZATION_ID=your-org-uuid
   LOCAL_DATA_DIR=./data
   ```

2. Run the import:

   ```bash
   bun run migrate:local
   ```

Imports `data/candidates/`, SQLite notes/runs, and PDFs into Supabase Storage.

---

## Deploy to Vercel

1. Connect this repo — **Root Directory** is the repo root (no subdirectory).
2. Framework: **TanStack Start** (via `vercel.json`).
3. Set env vars from `.env.example` (including `VITE_SUPABASE_*`).
4. Gmail redirect: `https://your-app.vercel.app/api/gmail/callback`
5. Supabase Auth redirect: `https://your-app.vercel.app/auth/callback`

See [`docs/production-deployment.md`](docs/production-deployment.md) for the full production checklist.

---

## Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `bun run dev`         | Dev server on `:3000`                |
| `bun run build`       | Production build                     |
| `bun run preview`     | Preview production build locally     |
| `bun run migrate:local` | Import `./data` into Supabase      |
| `bun run db:studio`   | Drizzle Studio (database browser)    |
| `bun run generate-routes` | Regenerate TanStack Router routes |

---

## Project structure

```text
config/                 # job-criteria.yaml, email templates
data/                   # local candidate PII (gitignored)
docs/                   # architecture, migration roadmap, module docs
old-app/                # legacy Next.js + FastAPI stack (archived)
scripts/                # migrate-local-data.ts
src/
  db/                   # Drizzle schema
  server/               # business logic + TanStack server functions
  components/           # UI (candidates, analyze, sync, settings)
  routes/               # TanStack Router pages + API routes
  lib/                  # API client, Supabase config, utilities
supabase/               # Postgres migrations + RLS policies
vercel.json
```

---

## Routes

| Route                          | Access | Description                    |
| ------------------------------ | ------ | ------------------------------ |
| `/`                            | Auth   | Dashboard with pipeline stats  |
| `/login`                       | Public | Sign in                        |
| `/signup`                      | Public | Create account                 |
| `/auth/callback`               | Public | Supabase auth callback         |
| `/candidates/`                 | Auth   | Searchable candidate table     |
| `/candidates/$slug`            | Auth   | Profile, score, resume, email  |
| `/analyze/`                    | Auth   | Rank & analyze workspace       |
| `/reports/`                    | Auth   | Saved analysis runs            |
| `/reports/$id`                 | Auth   | Report detail                  |
| `/sync/`                       | Auth   | Gmail sync panel               |
| `/settings/`                   | Auth   | Gmail connect + job criteria   |
| `/api/gmail/callback`          | Public | Gmail OAuth callback           |
| `/pdf-proxy/$slug/$filename`   | Auth   | Authenticated PDF proxy        |

---

## Documentation

| Doc | Description |
| --- | ----------- |
| [`docs/architecture.md`](docs/architecture.md) | System overview and tenancy model |
| [`docs/migration-roadmap.md`](docs/migration-roadmap.md) | Cloud migration phases |
| [`docs/production-deployment.md`](docs/production-deployment.md) | Production deploy checklist |
| [`old-app/README.md`](old-app/README.md) | Legacy local stack workflow |

---

<p align="center">
  Built for hiring teams who want applicant data, scoring, and outreach in one place — not scattered across inboxes and spreadsheets.
</p>
