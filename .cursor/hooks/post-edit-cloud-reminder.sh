#!/usr/bin/env bash
# Remind agent to update module docs when editing migration-related files.
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path // .path // empty')

if [[ "$file_path" == supabase/migrations/* ]]; then
  cat <<EOF
{
  "additional_context": "You edited \`$file_path\`. Update docs/modules/*.md if schema semantics changed. Verify RLS policies on all tenant tables."
}
EOF
  exit 0
fi

exit 0
