#!/usr/bin/env bash
# Inject project context at session start.
set -euo pipefail

cat <<'EOF'
{
  "additional_context": "Kame Pick — TanStack Start + Supabase at repo root. Dev: `bun run dev`. Never commit data/candidates/, .env, or token.json. Postgres migrations in supabase/migrations/. Use Supabase pooler URL for DATABASE_URL (direct db.* host can be IPv6-only)."
}
EOF
