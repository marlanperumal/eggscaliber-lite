#!/usr/bin/env bash
set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Starting API server for type generation..."
cd "$REPO_ROOT/apps/api"
uv run uvicorn src.main:app --port 8001 &
API_PID=$!
trap "kill $API_PID 2>/dev/null" EXIT

echo "Waiting for API to be ready on :8001..."
for i in $(seq 1 60); do
    if curl -sf http://localhost:8001/openapi.json -o /dev/null; then
        echo "API ready after ${i}s"
        break
    fi
    if ! kill -0 $API_PID 2>/dev/null; then
        echo "ERROR: uvicorn exited before becoming ready" >&2
        exit 1
    fi
    if [ "$i" = "60" ]; then
        echo "ERROR: API did not become ready within 60s" >&2
        exit 1
    fi
    sleep 1
done

cd "$REPO_ROOT"
pnpm openapi-typescript http://localhost:8001/openapi.json -o packages/shared/api.d.ts
echo "Types generated to packages/shared/api.d.ts"
