#!/usr/bin/env bash
# Inject project context at session start for the agent.
set -euo pipefail

cat <<'EOF'
{
  "additional_context": "Job Applicants Analyzer — dual-mode app (local FastAPI + filesystem AND phased Supabase cloud). Key docs: docs/architecture.md, docs/migration-roadmap.md. Dev: `source .venv/bin/activate && npm run dev`. Never commit data/candidates/, .env, or token.json. Cloud code goes in server/cloud/; do not remove local code until Phase 6."
}
EOF
