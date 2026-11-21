#!/usr/bin/env bash
# Per-worktree Vite UI on a sticky local port (3300-3399).
# The primary checkout keeps :3000. Orca worktrees get their own port.
#
# Usage:
#   bun run ui
#   ./scripts/dev/ui-worktree.sh
#   ./scripts/dev/ui-worktree.sh --print-port
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PORT="$(node --input-type=module -e "
import { LOCAL_DEV_PORT } from './scripts/dev/local-dev-port.mjs';
console.log(LOCAL_DEV_PORT);
")"

if [[ "${1:-}" == "--print-port" ]]; then
  echo "$PORT"
  exit 0
fi

mkdir -p "$ROOT/.local"

listener_under_root() {
  local port="$1" pid cwd
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  [[ -n "$pid" ]] || return 1
  cwd="$(lsof -a -p "$pid" -d cwd 2>/dev/null | awk 'NR==2 { print $NF; exit }')"
  [[ -n "$cwd" && ( "$cwd" == "$ROOT" || "$cwd" == "$ROOT"/* ) ]]
}

for _ in $(seq 1 100); do
  if ! lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 || listener_under_root "$PORT"; then
    break
  fi
  PORT=$((PORT + 1))
  ((PORT >= 3400)) && PORT=3300
done

export LOCAL_DEV_PORT="$PORT"
printf '%s\n' "$PORT" >"$ROOT/.local/vite-port"

echo "Worktree UI port ${PORT} (http://127.0.0.1:${PORT}/)"
exec bunx vite dev --host 127.0.0.1 --port "$PORT" --strictPort
