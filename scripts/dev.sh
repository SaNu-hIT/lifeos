#!/usr/bin/env bash
# Runs the composed backend (apps/server) and the web UI (apps/web) together.
# Ctrl+C stops both.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm --filter @lifeos/server build

pids=()
cleanup() {
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

pnpm --filter @lifeos/server start &
pids+=($!)

pnpm --filter @lifeos/web dev &
pids+=($!)

wait
