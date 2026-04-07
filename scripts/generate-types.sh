#!/usr/bin/env bash
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Starting API server for type generation..."
cd "$REPO_ROOT/apps/api"
uv run --no-env-file uvicorn src.main:app --port 8001 &
API_PID=$!
trap "kill $API_PID 2>/dev/null" EXIT
sleep 2
cd "$REPO_ROOT"
pnpm openapi-typescript http://localhost:8001/openapi.json -o packages/shared/api.d.ts
echo "Types generated to packages/shared/api.d.ts"
