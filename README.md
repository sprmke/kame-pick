# Kame Pick

Full-stack hiring dashboard built with **Bun**, **TanStack Start**, **Supabase (Postgres + Auth + Storage)**, and **Drizzle ORM**. Deploys to **Vercel** as a single app.

The previous Next.js + FastAPI stack is preserved in [`old-app/`](old-app/) for reference.

## Stack

| Layer | Technology |
|-------|------------|
| Runtime / package manager | Bun |
| Full-stack framework | TanStack Start + TanStack Router |
| UI | React 19, Tailwind 4 |
| Database | Supabase Postgres |
| ORM | Drizzle |
| Auth & file storage | Supabase Auth + Storage |
| Hosting | Vercel (Nitro preset) |

## Quick start

### 1. Supabase

1. Create a [Supabase](https://supabase.com) project.
2. Apply migrations:

   ```bash
   cd supabase
   supabase db push
   # or run each file from supabase/migrations/ in the SQL editor
   ```

3. Copy API keys to `.env.local` (see `.env.example`).

### 2. Local dev

```bash
cp .env.example .env.local
# Fill: DATABASE_URL, SUPABASE_*, VITE_SUPABASE_*

bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) → sign up → dashboard.

### 3. Migrate existing local data

After signup, copy your **organization UUID** from Supabase into `.env.local`:

```
ORGANIZATION_ID=your-org-uuid
LOCAL_DATA_DIR=./data
```

Then run:

```bash
bun run migrate:local
```

Imports `data/candidates/`, `data/app.db` notes/runs, and PDFs into Supabase Storage.

## Deploy to Vercel

1. Connect this repo — **Root Directory** is the repo root (no subdirectory).
2. Framework: **TanStack Start** (via `vercel.json`).
3. Set env vars from `.env.example` (including `VITE_SUPABASE_*`).
4. Gmail redirect: `https://your-app.vercel.app/api/gmail/callback`
5. Supabase Auth redirect: `https://your-app.vercel.app/auth/callback`

## Project structure

```
├── config/           # job-criteria.yaml, email templates
├── data/             # local candidate PII (gitignored)
├── docs/             # architecture & migration notes
├── old-app/          # legacy Next.js + FastAPI stack
├── scripts/          # migrate-local-data.ts
├── src/
│   ├── db/           # Drizzle schema
│   ├── server/       # business logic + server functions
│   ├── components/   # UI
│   └── routes/       # TanStack Router pages
├── supabase/         # Postgres migrations + RLS
└── vercel.json
```

## Scripts

```bash
bun run dev              # Dev server :3000
bun run build            # Production build
bun run migrate:local    # Import ./data into Supabase
bun run db:studio        # Drizzle Studio
```

## Legacy stack

To run the old local Next.js + FastAPI app:

```bash
cd old-app
source ../.venv/bin/activate   # or create venv + pip install -r requirements.txt
npm run dev                    # from old-app/package.json
```

See [`old-app/README.md`](old-app/README.md) for Gmail OAuth and local filesystem workflow.
