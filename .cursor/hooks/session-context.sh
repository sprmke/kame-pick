#!/usr/bin/env bash
# Inject project context at session start for the agent.
set -euo pipefail

cat <<'EOF'
{
  "additional_context": "Kame Pick — TanStack Start + Supabase at repo root. Legacy Next.js + FastAPI in old-app/. Dev: `bun run dev`. Never commit data/candidates/, .env, or token.json. Postgres migrations in supabase/migrations/."
}
EOF
