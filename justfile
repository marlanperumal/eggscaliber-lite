set dotenv-load
set dotenv-filename := ".env.local"

# Default: list available commands
default:
    @just --list

# ===== Dependencies =====

# Add a runtime dependency to apps/api
add-api-dep package:
    uv add --project apps/api {{package}}

# Add a dev dependency to apps/api
add-api-dev-dep package:
    uv add --dev --project apps/api {{package}}

# Add a runtime dependency to apps/web
add-web-dep package:
    pnpm --filter web add {{package}}

# Add a dev dependency to apps/web
add-web-dev-dep package:
    pnpm --filter web add -D {{package}}

# ===== Setup =====

# Bootstrap everything for a new developer
setup:
    pnpm install
    uv sync
    just db-up
    @sleep 3
    just db-migrate
    just generate-types

# ===== Development =====

# Run api + web concurrently (requires db to be up separately)
dev:
    pnpm concurrently \
        "just api" \
        "just web" \
        --names "api,web" \
        --prefix-colors "green,blue"

# Next.js dev server
web:
    cd apps/web && pnpm dev

# FastAPI dev server
api:
    cd apps/api && uv run uvicorn src.main:app --reload --port 8000

# Kill the FastAPI dev server (port 8000)
kill-api:
    kill $(lsof -ti:8000) 2>/dev/null || true

# Kill the Next.js dev server (port 3000)
kill-web:
    kill $(lsof -ti:3000) 2>/dev/null || true

# Kill both dev servers
kill-dev:
    just kill-api
    just kill-web

# Build Next.js for production
build:
    cd apps/web && pnpm build

# Storybook dev server
storybook:
    cd apps/web && pnpm storybook

# Marimo notebook server
notebook:
    uv run marimo edit notebooks/

# ===== Database =====

# Start Docker containers
db-up:
    docker compose up -d

# Stop Docker containers (keep volumes)
db-down:
    docker compose down

# Wipe volumes and restart fresh
db-reset:
    docker compose down -v
    docker compose up -d
    @sleep 3
    just db-migrate

# Run seed scripts
db-seed:
    cd apps/api && uv run python -m scripts.seed

# Run Alembic migrations (dev DB)
db-migrate:
    cd apps/api && uv run alembic upgrade head

# Generate a new migration from model changes
db-migration name:
    cd apps/api && uv run alembic revision --autogenerate -m "{{name}}"

# ===== Shared Types =====

# Generate TypeScript types from FastAPI OpenAPI spec
generate-types:
    bash scripts/generate-types.sh

# Fail if generated types are stale (used in CI)
check-types:
    just generate-types
    git diff --exit-code packages/shared/api.d.ts || (echo "ERROR: packages/shared/api.d.ts is stale. Run 'just generate-types' and commit." && exit 1)

# ===== Quality =====

# Run all tests
test:
    just test-api
    just test-web

# Run Python tests (pass extra args e.g. `just test-api -k test_name`)
test-api *args:
    cd apps/api && uv run pytest -v {{args}}

# Run TypeScript tests
test-web:
    cd apps/web && pnpm vitest run

# Run E2E tests — requires dev servers already running (`just dev`) and seed data (`just db-seed`)
# Optional args passed to playwright: e.g. just test-e2e --headed, just test-e2e analytics
test-e2e *args:
    pnpm exec playwright test {{args}}

# Install Playwright browsers (run once after cloning, or after updating @playwright/test)
install-browsers:
    pnpm exec playwright install --with-deps chromium

# Lint Python (ruff) + TypeScript (biome)
lint:
    cd apps/api && uv run ruff check .
    cd apps/web && pnpm biome check src/

# Format Python (ruff) + TypeScript (biome)
format:
    cd apps/api && uv run ruff format .
    cd apps/web && pnpm biome format --write src/

# Check formatting without writing (used in CI)
format-check:
    cd apps/api && uv run ruff format --check .
    cd apps/web && pnpm biome check --formatter-enabled=true src/

# Type check Python + TypeScript
typecheck:
    cd apps/api && uv run ty check src/
    cd apps/web && pnpm tsc --noEmit

# Security audit Python + JS dependencies
audit:
    cd apps/api && uv run pip-audit
    cd apps/web && pnpm audit --audit-level moderate
