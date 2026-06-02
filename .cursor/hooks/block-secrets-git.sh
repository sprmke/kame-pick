#!/usr/bin/env bash
# Block git operations that would commit secrets or PII paths.
set -euo pipefail

input=$(cat)
command=$(echo "$input" | jq -r '.command // empty')

# Patterns for sensitive paths
SENSITIVE_PATTERN='(\.env(\.|$|local)|credentials\.json|token\.json|token\.pickle|data/candidates/|data/app\.db|data/reports/)'

if echo "$command" | grep -qE 'git (add|commit|push)'; then
  if echo "$command" | grep -qE "$SENSITIVE_PATTERN"; then
    echo '{
      "permission": "deny",
      "user_message": "This git command references secrets or candidate PII paths. Those files are gitignored — do not commit them.",
      "agent_message": "Hook blocked a git command touching .env, credentials.json, token.json, data/candidates/, data/app.db, or data/reports/. Warn the user and stage only safe files."
    }'
    exit 0
  fi

  # git add -A or git add . can accidentally stage ignored files if force-added
  if echo "$command" | grep -qE 'git add (\.-A|--all|\.)'; then
    echo '{
      "permission": "ask",
      "user_message": "Broad git add detected. Please confirm no secrets or candidate data will be included.",
      "agent_message": "Review staged files with git status before committing. Never include data/candidates/, .env, or token.json."
    }'
    exit 0
  fi
fi

echo '{ "permission": "allow" }'
exit 0
