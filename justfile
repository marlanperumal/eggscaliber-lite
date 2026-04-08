set dotenv-load
set dotenv-filename := ".env.local"

# Default: list available commands
default:
    @just --list

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
    cd apps/api && uv run --no-env-file uvicorn src.main:app --reload --port 8000

# Build Next.js for production
build:
    cd apps/web && pnpm build

# Storybook dev server
storybook:
    cd apps/web && pnpm storybook

# Marimo notebook server
notebook:
    uv run --no-env-file marimo edit notebooks/

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
    cd apps/api && uv run --no-env-file python -m scripts.seed

# Run Alembic migrations (dev DB)
db-migrate:
    cd apps/api && uv run --no-env-file alembic upgrade head

# Generate a new migration from model changes
db-migration name:
    cd apps/api && uv run --no-env-file alembic revision --autogenerate -m "{{name}}"

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

# Run Python tests
test-api:
    cd apps/api && uv run --no-env-file pytest -v

# Run TypeScript tests
test-web:
    cd apps/web && pnpm vitest run

# Lint Python (ruff) + TypeScript (biome)
lint:
    cd apps/api && uv run --no-env-file ruff check .
    cd apps/web && pnpm biome check src/

# Format Python (ruff) + TypeScript (biome)
format:
    cd apps/api && uv run --no-env-file ruff format .
    cd apps/web && pnpm biome format --write src/

# Check formatting without writing (used in CI)
format-check:
    cd apps/api && uv run --no-env-file ruff format --check .
    cd apps/web && pnpm biome check --formatter-enabled=true src/

# Type check Python + TypeScript
typecheck:
    cd apps/api && uv run --no-env-file ty check src/
    cd apps/web && pnpm tsc --noEmit

# Security audit Python + JS dependencies
audit:
    cd apps/api && uv run --no-env-file pip-audit
    cd apps/web && pnpm audit --audit-level moderate
