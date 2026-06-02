#!/usr/bin/env bash
# Remind agent to update module docs when editing migration-related files.
set -euo pipefail

input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path // .path // empty')

if [[ "$file_path" == supabase/migrations/* ]] || [[ "$file_path" == server/cloud/* ]]; then
  cat <<EOF
{
  "additional_context": "You edited \`$file_path\`. If this implements a migration phase, update the matching docs/modules/*.md changelog and verify RLS policies. Test both local mode (no Supabase env) and cloud mode."
}
EOF
  exit 0
fi

exit 0
