# Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Eggscaliber-Lite monorepo with all services configured, CI green, and a working design system deployed to Chromatic.

**Architecture:** pnpm workspace (JS) + uv workspace (Python) in a single repo. FastAPI backend (`apps/api`) and Next.js frontend (`apps/web`) with TypeScript types auto-generated from the FastAPI OpenAPI spec into `packages/shared`. Two Docker containers for local dev (pgvector Postgres + MinIO). All commands run from the root via `justfile`.

**Tech Stack:** Next.js 15 (App Router), FastAPI, SQLModel, Alembic, shadcn/ui, Tailwind CSS v4, Storybook 8, Recharts, uv, pnpm 9, husky, commitlint, Neon, Clerk, Cloudflare R2, PostHog, Sentry, GitHub Actions

---

## File Map

### Root
| Action | Path | Purpose |
| --- | --- | --- |
| Create | `package.json` | pnpm workspace root, dev scripts |
| Create | `pnpm-workspace.yaml` | declares `apps/*` and `packages/*` |
| Create | `pyproject.toml` | uv workspace root |
| Create | `justfile` | all commands |
| Create | `.editorconfig` | indentation rules |
| Create | `.commitlintrc.json` | conventional commit config |
| Create | `.lintstagedrc.json` | per-filetype lint-staged rules |
| Create | `.env.example` | all required keys, no secrets |
| Create | `docker-compose.yml` | local dev containers |
| Create | `.github/dependabot.yml` | automated security PRs |
| Create | `.github/workflows/pr.yml` | PR quality gate |
| Create | `.github/workflows/deploy.yml` | merge-to-main deploy |
| Modify | `CLAUDE.md` | full project conventions |
| Modify | `.gitignore` | add node_modules, .env.local, __pycache__ etc. |

### docker/
| Action | Path | Purpose |
| --- | --- | --- |
| Create | `docker/init/01-create-databases.sql` | create dev + test DBs |
| Create | `docker/init/02-extensions.sql` | `CREATE EXTENSION vector` on all DBs |

### apps/api/
| Action | Path | Purpose |
| --- | --- | --- |
| Create | `apps/api/pyproject.toml` | FastAPI, SQLModel, Alembic, sentry-sdk, pydantic-settings, pip-audit deps |
| Create | `apps/api/src/__init__.py` | package marker |
| Create | `apps/api/src/main.py` | FastAPI app factory, Sentry init, router registration |
| Create | `apps/api/src/config.py` | `Settings` via pydantic-settings, reads env vars |
| Create | `apps/api/src/database.py` | engine, `SessionLocal`, `get_session` dependency |
| Create | `apps/api/src/routes/__init__.py` | package marker |
| Create | `apps/api/src/routes/health.py` | `GET /api/v1/health` |
| Create | `apps/api/alembic.ini` | Alembic config |
| Create | `apps/api/migrations/env.py` | Alembic env, reads `settings.database_url` |
| Create | `apps/api/migrations/script.py.mako` | migration file template |
| Create | `apps/api/migrations/versions/.gitkeep` | keep empty dir in git |
| Create | `apps/api/tests/__init__.py` | package marker |
| Create | `apps/api/tests/conftest.py` | engine + transaction-rollback session + TestClient fixtures |
| Create | `apps/api/tests/test_health.py` | health endpoint test |
| Create | `apps/api/tests/test_migrations.py` | 3 migration tests |

### apps/web/
| Action | Path | Purpose |
| --- | --- | --- |
| Create | `apps/web/package.json` | Next.js, shadcn/ui, Storybook, PostHog, Sentry, Recharts, openapi-fetch deps |
| Create | `apps/web/next.config.ts` | Next.js config with Sentry wrapper |
| Create | `apps/web/tsconfig.json` | strict mode enabled |
| Create | `apps/web/tailwind.config.ts` | design tokens (colours, spacing, typography) |
| Create | `apps/web/components.json` | shadcn/ui config |
| Create | `apps/web/src/app/layout.tsx` | root layout, PostHog provider, Clerk provider |
| Create | `apps/web/src/app/page.tsx` | hello world page |
| Create | `apps/web/src/app/globals.css` | Tailwind directives + shadcn CSS variables |
| Create | `apps/web/src/app/sentry.client.config.ts` | Sentry browser config |
| Create | `apps/web/src/app/sentry.server.config.ts` | Sentry server config |
| Create | `apps/web/src/lib/posthog.tsx` | PostHog provider component |
| Create | `apps/web/src/components/ui/button.tsx` | shadcn Button (customised) |
| Create | `apps/web/src/components/ui/button.stories.tsx` | Button stories (all variants + sizes) |
| Create | `apps/web/src/components/ui/input.tsx` | shadcn Input |
| Create | `apps/web/src/components/ui/input.stories.tsx` | Input stories |
| Create | `apps/web/src/components/ui/badge.tsx` | shadcn Badge |
| Create | `apps/web/src/components/ui/badge.stories.tsx` | Badge stories |
| Create | `apps/web/src/components/ui/card.tsx` | shadcn Card |
| Create | `apps/web/src/components/ui/card.stories.tsx` | Card stories |
| Create | `apps/web/src/stories/DesignTokens.stories.tsx` | Design System section: colours, spacing, typography |
| Create | `apps/web/.storybook/main.ts` | Storybook config |
| Create | `apps/web/.storybook/preview.ts` | global decorators, Tailwind import |
| Create | `apps/web/vitest.config.ts` | vitest with jsdom |
| Create | `apps/web/src/app/page.test.tsx` | basic render test |

### packages/shared/
| Action | Path | Purpose |
| --- | --- | --- |
| Create | `packages/shared/package.json` | package descriptor |
| Create | `packages/shared/api.d.ts` | generated OpenAPI types (initially empty shell) |

### docs/
| Action | Path | Purpose |
| --- | --- | --- |
| Create | `docs/patterns.md` | index + inline rules (read by audit-patterns skill) |
| Create | `docs/patterns/backend.md` | 3-layer architecture detail |
| Create | `docs/patterns/frontend.md` | component and data-fetching patterns |
| Create | `docs/patterns/infrastructure.md` | Docker, CI, env config patterns |
| Create | `docs/testing.md` | testing standards and fixture patterns |

---

## Task 1: Root monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `pyproject.toml`
- Create: `.editorconfig`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "eggscaliber-lite",
  "private": true,
  "scripts": {
    "postinstall": "husky"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "concurrently": "^9.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "openapi-typescript": "^7.0.0"
  }
}
```

- [ ] **Step 3: Create root `pyproject.toml` (uv workspace)**

```toml
[tool.uv.workspace]
members = ["apps/api"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W", "UP", "B", "SIM"]
ignore = ["E501"]

[tool.ruff.format]
quote-style = "double"

[tool.pytest.ini_options]
testpaths = ["apps/api/tests"]
asyncio_mode = "auto"
```

- [ ] **Step 4: Create `.editorconfig`**

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{js,ts,tsx,jsx,json,yaml,yml,md,html,css}]
indent_style = space
indent_size = 2

[*.py]
indent_style = space
indent_size = 4
```

- [ ] **Step 5: Create `.env.example`**

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_dev
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_test
MIGRATIONS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test

# Auth — set AUTH_MODE=dev for local dev JWT bypass
AUTH_MODE=dev
DEV_JWT_SECRET=dev-secret-change-in-production
# Production: CLERK_SECRET_KEY=sk_...
# Production: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...

# Storage
# Local: automatically handled by MinIO defaults
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
# Production: R2_ACCOUNT_ID=...
# Production: R2_ACCESS_KEY_ID=...
# Production: R2_SECRET_ACCESS_KEY=...
# Production: R2_BUCKET_NAME=...

# Sentry (optional in dev)
# SENTRY_DSN=https://...@sentry.io/...
# NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Environment
ENVIRONMENT=development
```

- [ ] **Step 6: Update `.gitignore` — append the following**

```gitignore
# Node
node_modules/
.pnpm-store/

# Python
__pycache__/
*.py[cod]
.venv/

# Environment files (keep .env.example)
.env.local
.env.staging
.env.production

# Build outputs
.next/
dist/
build/

# Test coverage
.coverage
htmlcov/
coverage/

# Storybook
storybook-static/
```

- [ ] **Step 7: Install root dependencies**

```bash
pnpm install
```

Expected: `node_modules/` created, husky installed.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml pyproject.toml .editorconfig .env.example .gitignore
git commit -m "chore: scaffold monorepo root (pnpm workspace + uv workspace)"
```

---

## Task 2: Docker local dev setup

**Files:**
- Create: `docker-compose.yml`
- Create: `docker/init/01-create-databases.sql`
- Create: `docker/init/02-extensions.sql`
- Create: `justfile`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  minio_data:
```

- [ ] **Step 2: Create `docker/init/01-create-databases.sql`**

```sql
CREATE DATABASE eggscaliber_dev;
CREATE DATABASE eggscaliber_test;
CREATE DATABASE eggscaliber_migrations_test;
```

- [ ] **Step 3: Create `docker/init/02-extensions.sql`**

```sql
\c eggscaliber_dev
CREATE EXTENSION IF NOT EXISTS vector;

\c eggscaliber_test
CREATE EXTENSION IF NOT EXISTS vector;

\c eggscaliber_migrations_test
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 4: Create the full `justfile`**

```just
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
    cd apps/api && uv run uvicorn src.main:app --reload --port 8000

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
    #!/usr/bin/env bash
    set -e
    echo "Starting API server for type generation..."
    cd apps/api && uv run uvicorn src.main:app --port 8001 &
    API_PID=$!
    sleep 2
    pnpm openapi-typescript http://localhost:8001/openapi.json -o packages/shared/api.d.ts
    kill $API_PID
    echo "Types generated to packages/shared/api.d.ts"

# Fail if generated types are stale (used in CI)
check-types:
    #!/usr/bin/env bash
    set -e
    just generate-types
    if ! git diff --exit-code packages/shared/api.d.ts; then
        echo "ERROR: packages/shared/api.d.ts is stale. Run 'just generate-types' and commit."
        exit 1
    fi

# ===== Quality =====

# Run all tests
test:
    just test-api
    just test-web

# Run Python tests
test-api:
    cd apps/api && uv run pytest -v

# Run TypeScript tests
test-web:
    cd apps/web && pnpm vitest run

# Lint Python + TypeScript
lint:
    cd apps/api && uv run ruff check .
    cd apps/web && pnpm eslint src/

# Format Python + TypeScript
format:
    cd apps/api && uv run ruff format .
    cd apps/web && pnpm prettier --write src/

# Check formatting without writing (used in CI)
format-check:
    cd apps/api && uv run ruff format --check .
    cd apps/web && pnpm prettier --check src/

# Type check Python + TypeScript
typecheck:
    cd apps/api && uv run ty check src/
    cd apps/web && pnpm tsc --noEmit

# Security audit Python + JS dependencies
audit:
    cd apps/api && uv run pip-audit
    cd apps/web && pnpm audit --audit-level moderate
```

- [ ] **Step 5: Start containers and verify**

```bash
just db-up
sleep 3
docker compose ps
```

Expected: both `postgres` and `minio` show `healthy`.

- [ ] **Step 6: Verify databases were created**

```bash
docker compose exec postgres psql -U postgres -c "\l"
```

Expected: output includes `eggscaliber_dev`, `eggscaliber_test`, `eggscaliber_migrations_test`.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml docker/ justfile
git commit -m "chore: add Docker local dev setup and justfile"
```

---

## Task 3: FastAPI skeleton + health endpoint (TDD)

**Files:**
- Create: `apps/api/pyproject.toml`
- Create: `apps/api/src/__init__.py`
- Create: `apps/api/src/config.py`
- Create: `apps/api/src/database.py`
- Create: `apps/api/src/main.py`
- Create: `apps/api/src/routes/__init__.py`
- Create: `apps/api/src/routes/health.py`
- Create: `apps/api/tests/__init__.py`
- Create: `apps/api/tests/conftest.py`
- Create: `apps/api/tests/test_health.py`

- [ ] **Step 1: Create `apps/api/pyproject.toml`**

```toml
[project]
name = "api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlmodel>=0.0.21",
    "alembic>=1.13.0",
    "pydantic-settings>=2.0.0",
    "sentry-sdk[fastapi]>=2.0.0",
    "psycopg2-binary>=2.9.0",
]

[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
    "pip-audit>=2.7.0",
    "ty>=0.0.1a0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src"]
```

- [ ] **Step 2: Install API dependencies**

```bash
cd apps/api && uv sync
```

Expected: `.venv` created, all packages installed.

- [ ] **Step 3: Write the failing test**

Create `apps/api/tests/conftest.py`:

```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from src.config import settings
from src.main import app
from src.database import get_session


@pytest.fixture(scope="session")
def engine():
    test_engine = create_engine(settings.test_database_url)
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def db(engine):
    connection = engine.connect()
    transaction = connection.begin()
    TestSession = sessionmaker(bind=connection)
    session = TestSession()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session):
    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

Create `apps/api/tests/test_health.py`:

```python
def test_health_returns_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd apps/api && uv run pytest tests/test_health.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` — `src.main` does not exist yet.

- [ ] **Step 5: Create `apps/api/src/__init__.py`** (empty file)

- [ ] **Step 6: Create `apps/api/src/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://postgres:postgres@localhost:5432/eggscaliber_dev"
    test_database_url: str = "postgresql://postgres:postgres@localhost:5432/eggscaliber_test"
    migrations_test_database_url: str = (
        "postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test"
    )

    auth_mode: str = "dev"
    dev_jwt_secret: str = "dev-secret-change-in-production"

    sentry_dsn: str | None = None
    environment: str = "development"


settings = Settings()
```

- [ ] **Step 7: Create `apps/api/src/database.py`**

```python
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
```

- [ ] **Step 8: Create `apps/api/src/routes/__init__.py`** (empty file)

- [ ] **Step 9: Create `apps/api/src/routes/health.py`**

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 10: Create `apps/api/src/main.py`**

```python
import sentry_sdk
from fastapi import FastAPI

from src.config import settings
from src.routes import health

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )

app = FastAPI(title="Eggscaliber-Lite API", version="0.1.0")

app.include_router(health.router, prefix="/api/v1")
```

- [ ] **Step 11: Create `apps/api/tests/__init__.py`** (empty file)

- [ ] **Step 12: Run test to verify it passes**

```bash
cd apps/api && uv run pytest tests/test_health.py -v
```

Expected:
```
PASSED tests/test_health.py::test_health_returns_ok
1 passed in X.XXs
```

- [ ] **Step 13: Verify the server starts manually**

```bash
cd apps/api && uv run uvicorn src.main:app --port 8000
```

Open `http://localhost:8000/api/v1/health` — expect `{"status":"ok"}`.
Open `http://localhost:8000/docs` — expect Swagger UI.
Stop with Ctrl+C.

- [ ] **Step 14: Commit**

```bash
git add apps/api/
git commit -m "feat(api): add FastAPI skeleton with health endpoint"
```

---

## Task 4: Alembic setup + migration tests

**Files:**
- Create: `apps/api/alembic.ini`
- Create: `apps/api/migrations/env.py`
- Create: `apps/api/migrations/script.py.mako`
- Create: `apps/api/migrations/versions/.gitkeep`
- Create: `apps/api/tests/test_migrations.py`

- [ ] **Step 1: Write the failing migration tests**

Create `apps/api/tests/test_migrations.py`:

```python
import pytest
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

from src.config import settings

ALEMBIC_CFG_PATH = "alembic.ini"


@pytest.fixture(scope="module")
def alembic_config():
    return Config(ALEMBIC_CFG_PATH)


@pytest.fixture(scope="module")
def migrations_engine():
    """Dedicated engine for the upgrade/downgrade cycle test.

    Uses eggscaliber_migrations_test so the cycle does not disrupt the
    main test DB that other tests rely on being at head.
    """
    eng = create_engine(settings.migrations_test_database_url)
    yield eng
    eng.dispose()


def test_single_migration_head(alembic_config):
    """Migration history must be linear — exactly one head."""
    script = ScriptDirectory.from_config(alembic_config)
    heads = script.get_heads()
    assert len(heads) == 1, (
        f"Expected exactly 1 migration head, found {len(heads)}: {heads}. "
        "This usually means two branches were merged without resolving Alembic heads. "
        "Run: alembic merge heads -m 'merge heads'"
    )


def test_no_pending_model_changes(alembic_config):
    """All SQLModel model changes must have a corresponding Alembic migration.

    Assumes the test DB (eggscaliber_test) has already been upgraded to head
    before the test suite runs. CI does this via 'just db-migrate' before pytest.
    """
    try:
        command.check(alembic_config)
    except SystemExit as exc:
        pytest.fail(
            f"Models have changes not reflected in migrations. "
            f"Run 'just db-migration <name>' to generate one. Details: {exc}"
        )


def test_migration_upgrade_downgrade_cycle(alembic_config, migrations_engine):
    """Full upgrade → downgrade → upgrade cycle on the dedicated migrations test DB."""
    # Point alembic at the migrations test DB for this test only
    cycle_config = Config(ALEMBIC_CFG_PATH)
    cycle_config.set_main_option("sqlalchemy.url", settings.migrations_test_database_url)

    command.upgrade(cycle_config, "head")
    command.downgrade(cycle_config, "base")
    command.upgrade(cycle_config, "head")

    # Verify we landed at the expected head
    with migrations_engine.connect() as conn:
        context = MigrationContext.configure(conn)
        current_heads = set(context.get_current_heads())

    script = ScriptDirectory.from_config(cycle_config)
    expected_heads = set(script.get_heads())
    assert current_heads == expected_heads, (
        f"After full cycle, expected heads {expected_heads}, got {current_heads}. "
        "A downgrade() method likely does not reverse its upgrade() correctly."
    )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && uv run pytest tests/test_migrations.py -v
```

Expected: `FileNotFoundError: alembic.ini` or similar — Alembic not configured yet.

- [ ] **Step 3: Create `apps/api/alembic.ini`**

```ini
[alembic]
script_location = migrations
prepend_sys_path = .
version_path_separator = os

[post_write_hooks]

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 4: Create `apps/api/migrations/env.py`**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

from src.config import settings

config = context.config

# Override the DB URL from settings (allows env vars to control target DB)
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models here so Alembic can detect them for autogenerate.
# Add new model imports below this line as models are created.
# e.g. from src.models.dataset import Dataset  # noqa: F401

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 5: Create `apps/api/migrations/script.py.mako`**

```mako
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op
${imports if imports else ""}

revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 6: Create `apps/api/migrations/versions/.gitkeep`** (empty file)

- [ ] **Step 7: Run migration tests to verify they pass**

```bash
cd apps/api && uv run pytest tests/test_migrations.py -v
```

Expected: All 3 tests pass. (With no models yet, the schema is empty — upgrade/downgrade/check all pass trivially.)

- [ ] **Step 8: Verify `just db-migrate` works**

```bash
just db-migrate
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade  -> head` (no migrations = no-op, no error).

- [ ] **Step 9: Commit**

```bash
git add apps/api/alembic.ini apps/api/migrations/ apps/api/tests/test_migrations.py
git commit -m "feat(api): add Alembic setup and migration test suite"
```

---

## Task 5: Code quality configuration

**Files:**
- Create: `.commitlintrc.json`
- Create: `.lintstagedrc.json`
- Create: `.husky/pre-commit`
- Create: `.husky/commit-msg`
- Create: `apps/web/.eslintrc.json`
- Create: `apps/web/.prettierrc`

- [ ] **Step 1: Create `.commitlintrc.json`**

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "scope-enum": [
      2,
      "always",
      ["api", "web", "shared", "docker", "ci", "deps", "docs", "notebooks"]
    ]
  }
}
```

- [ ] **Step 2: Create `.lintstagedrc.json`**

```json
{
  "*.py": ["ruff check --fix", "ruff format"],
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
  "*.{json,yaml,yml,md,css}": ["prettier --write"],
  "{pyproject.toml,apps/api/pyproject.toml}": ["sh -c 'cd apps/api && uv run pip-audit'"],
  "{package.json,pnpm-lock.yaml,apps/web/package.json}": ["sh -c 'cd apps/web && pnpm audit --audit-level moderate'"]
}
```

- [ ] **Step 3: Initialise husky**

```bash
pnpm dlx husky init
```

Expected: `.husky/` directory created with a default `pre-commit` file.

- [ ] **Step 4: Replace `.husky/pre-commit`**

```sh
#!/bin/sh
pnpm lint-staged
```

- [ ] **Step 5: Create `.husky/commit-msg`**

```sh
#!/bin/sh
pnpm commitlint --edit "$1"
```

- [ ] **Step 6: Create `apps/web/.eslintrc.json`**

```json
{
  "extends": [
    "next/core-web-vitals",
    "next/typescript"
  ],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }]
  }
}
```

- [ ] **Step 7: Create `apps/web/.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 8: Test a commit with a bad message to verify commitlint works**

```bash
git add .commitlintrc.json
git commit -m "bad commit message without type"
```

Expected: commit rejected with `⧗   input: bad commit message without type` and `✖   subject may not be empty`.

- [ ] **Step 9: Commit with a valid message**

```bash
git add .commitlintrc.json .lintstagedrc.json .husky/ apps/web/.eslintrc.json apps/web/.prettierrc
git commit -m "chore: add pre-commit hooks, commitlint, and code quality config"
```

---

## Task 6: Next.js application skeleton

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/page.test.tsx`
- Create: `apps/web/src/app/globals.css`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint src/",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "vitest": "vitest",
    "test": "vitest run"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.0.0",
    "@sentry/nextjs": "^8.0.0",
    "next": "^15.0.0",
    "openapi-fetch": "^0.12.0",
    "posthog-js": "^1.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.0.0"
  },
  "devDependencies": {
    "@storybook/addon-essentials": "^8.0.0",
    "@storybook/addon-interactions": "^8.0.0",
    "@storybook/nextjs": "^8.0.0",
    "@storybook/react": "^8.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "chromatic": "^11.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "jsdom": "^25.0.0",
    "prettier": "^3.0.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "storybook": "^8.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install web dependencies**

```bash
cd apps/web && pnpm install
```

- [ ] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../packages/shared/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

- [ ] **Step 5: Create `apps/web/src/test-setup.ts`**

```typescript
import "@testing-library/jest-dom"
```

- [ ] **Step 6: Write the failing page test**

Create `apps/web/src/app/page.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import Page from "./page"

describe("Home page", () => {
  it("renders the welcome heading", () => {
    render(<Page />)
    expect(screen.getByRole("heading", { name: /eggscaliber-lite/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

```bash
cd apps/web && pnpm vitest run src/app/page.test.tsx
```

Expected: `Error: Cannot find module './page'`

- [ ] **Step 8: Create `apps/web/src/app/globals.css`**

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    border-color: hsl(var(--border));
  }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

- [ ] **Step 9: Create `apps/web/src/app/layout.tsx`**

```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Eggscaliber Lite",
  description: "Data analysis platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 10: Create `apps/web/src/app/page.tsx`**

```typescript
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Eggscaliber-Lite</h1>
      <p className="mt-4 text-muted-foreground">Data analysis platform — coming soon.</p>
    </main>
  )
}
```

- [ ] **Step 11: Create `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Sentry will be wrapped here in Task 10
}

export default nextConfig
```

- [ ] **Step 12: Create `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/stories/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 13: Create `apps/web/components.json`** (shadcn/ui config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 14: Create `apps/web/src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 15: Install clsx and tailwind-merge**

```bash
cd apps/web && pnpm add clsx tailwind-merge
```

- [ ] **Step 16: Run page test to verify it passes**

```bash
cd apps/web && pnpm vitest run src/app/page.test.tsx
```

Expected:
```
✓ src/app/page.test.tsx > Home page > renders the welcome heading
1 passed
```

- [ ] **Step 17: Verify Next.js starts**

```bash
just web
```

Open `http://localhost:3000` — expect "Eggscaliber-Lite" heading. Stop with Ctrl+C.

- [ ] **Step 18: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add Next.js skeleton with Tailwind and shadcn/ui config"
```

---

## Task 7: Atomic components + Storybook

**Files:**
- Create: `apps/web/.storybook/main.ts`
- Create: `apps/web/.storybook/preview.ts`
- Create: `apps/web/src/components/ui/button.tsx` + `button.stories.tsx`
- Create: `apps/web/src/components/ui/input.tsx` + `input.stories.tsx`
- Create: `apps/web/src/components/ui/badge.tsx` + `badge.stories.tsx`
- Create: `apps/web/src/components/ui/card.tsx` + `card.stories.tsx`
- Create: `apps/web/src/stories/DesignTokens.stories.tsx`

- [ ] **Step 1: Create `apps/web/.storybook/main.ts`**

```typescript
import type { StorybookConfig } from "@storybook/nextjs"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {},
  },
}

export default config
```

- [ ] **Step 2: Create `apps/web/.storybook/preview.ts`**

```typescript
import type { Preview } from "@storybook/react"
import "../src/app/globals.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
```

- [ ] **Step 3: Create `apps/web/src/components/ui/button.tsx`**

```typescript
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

- [ ] **Step 4: Install button dependencies**

```bash
cd apps/web && pnpm add @radix-ui/react-slot class-variance-authority
```

- [ ] **Step 5: Create `apps/web/src/components/ui/button.stories.tsx`**

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Button } from "./button"

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = { args: { children: "Button" } }
export const Destructive: Story = { args: { children: "Delete", variant: "destructive" } }
export const Outline: Story = { args: { children: "Outline", variant: "outline" } }
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } }
export const Ghost: Story = { args: { children: "Ghost", variant: "ghost" } }
export const Small: Story = { args: { children: "Small", size: "sm" } }
export const Large: Story = { args: { children: "Large", size: "lg" } }
export const Disabled: Story = { args: { children: "Disabled", disabled: true } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      {(["default", "destructive", "outline", "secondary", "ghost", "link"] as const).map((v) => (
        <Button key={v} variant={v}>{v}</Button>
      ))}
    </div>
  ),
}
```

- [ ] **Step 6: Create `apps/web/src/components/ui/input.tsx`**

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-")
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium leading-none">
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  },
)
Input.displayName = "Input"

export { Input }
```

- [ ] **Step 7: Create `apps/web/src/components/ui/input.stories.tsx`**

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Input } from "./input"

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-80"><Story /></div>],
}

export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = { args: { placeholder: "Enter text..." } }
export const WithLabel: Story = { args: { label: "Email address", placeholder: "you@example.com", type: "email" } }
export const WithError: Story = { args: { label: "Email address", value: "notanemail", error: "Please enter a valid email address.", readOnly: true } }
export const Disabled: Story = { args: { label: "Disabled field", placeholder: "Cannot edit", disabled: true } }
```

- [ ] **Step 8: Create `apps/web/src/components/ui/badge.tsx`**

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
```

- [ ] **Step 9: Create `apps/web/src/components/ui/badge.stories.tsx`**

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: "Badge" } }
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } }
export const Destructive: Story = { args: { children: "Error", variant: "destructive" } }
export const Outline: Story = { args: { children: "Outline", variant: "outline" } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      {(["default", "secondary", "destructive", "outline"] as const).map((v) => (
        <Badge key={v} variant={v}>{v}</Badge>
      ))}
    </div>
  ),
}
```

- [ ] **Step 10: Create `apps/web/src/components/ui/card.tsx`**

```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  ),
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

- [ ] **Step 11: Create `apps/web/src/components/ui/card.stories.tsx`**

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card"
import { Button } from "./button"

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="w-96"><Story /></div>],
}

export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">Card content area.</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm">Cancel</Button>
        <Button size="sm">Confirm</Button>
      </CardFooter>
    </Card>
  ),
}

export const Simple: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Simple Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">No footer on this one.</p>
      </CardContent>
    </Card>
  ),
}
```

- [ ] **Step 12: Create `apps/web/src/stories/DesignTokens.stories.tsx`**

```typescript
import type { Meta, StoryObj } from "@storybook/react"

const meta: Meta = {
  title: "Design System/Tokens",
  parameters: { layout: "padded" },
}

export default meta

const colours = [
  { name: "Primary", var: "--primary" },
  { name: "Primary Foreground", var: "--primary-foreground" },
  { name: "Secondary", var: "--secondary" },
  { name: "Secondary Foreground", var: "--secondary-foreground" },
  { name: "Destructive", var: "--destructive" },
  { name: "Muted", var: "--muted" },
  { name: "Muted Foreground", var: "--muted-foreground" },
  { name: "Accent", var: "--accent" },
  { name: "Background", var: "--background" },
  { name: "Foreground", var: "--foreground" },
  { name: "Border", var: "--border" },
  { name: "Card", var: "--card" },
]

export const ColourPalette: StoryObj = {
  render: () => (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Colour Palette</h2>
      <div className="grid grid-cols-3 gap-4">
        {colours.map(({ name, var: v }) => (
          <div key={v} className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-md border"
              style={{ backgroundColor: `hsl(var(${v}))` }}
            />
            <div>
              <p className="text-sm font-medium">{name}</p>
              <p className="font-mono text-xs text-muted-foreground">{v}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
}

export const Typography: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <h2 className="mb-4 text-xl font-semibold">Typography</h2>
      <h1 className="text-4xl font-bold">Heading 1 — text-4xl font-bold</h1>
      <h2 className="text-3xl font-semibold">Heading 2 — text-3xl font-semibold</h2>
      <h3 className="text-2xl font-semibold">Heading 3 — text-2xl font-semibold</h3>
      <h4 className="text-xl font-medium">Heading 4 — text-xl font-medium</h4>
      <p className="text-base">Body text — text-base. The quick brown fox jumps over the lazy dog.</p>
      <p className="text-sm text-muted-foreground">Muted text — text-sm text-muted-foreground.</p>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">code snippet</code>
    </div>
  ),
}
```

- [ ] **Step 13: Install Storybook dependencies**

```bash
cd apps/web && pnpm add -D @radix-ui/react-slot
```

- [ ] **Step 14: Verify Storybook starts**

```bash
just storybook
```

Open `http://localhost:6006` — expect to see UI/Button, UI/Input, UI/Badge, UI/Card, and Design System/Tokens stories. Stop with Ctrl+C.

- [ ] **Step 15: Commit**

```bash
git add apps/web/
git commit -m "feat(web): add design system foundations — tokens and 5 atomic components with Storybook"
```

---

## Task 8: Shared types pipeline

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/api.d.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@eggscaliber/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./api.d.ts",
  "types": "./api.d.ts"
}
```

- [ ] **Step 2: Create initial `packages/shared/api.d.ts`**

```typescript
/**
 * AUTO-GENERATED — do not edit manually.
 * Run `just generate-types` to regenerate from the FastAPI OpenAPI spec.
 */

export interface paths {}
export interface components {}
export interface operations {}
```

- [ ] **Step 3: Generate real types from the running API**

```bash
just db-up
just api &
sleep 3
just generate-types
kill %1
```

Expected: `packages/shared/api.d.ts` is updated with the actual OpenAPI schema (health endpoint + FastAPI defaults).

- [ ] **Step 4: Verify `just check-types` passes**

```bash
just check-types
```

Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add OpenAPI → TypeScript type generation pipeline"
```

---

## Task 9: Sentry integration

**Files:**
- Modify: `apps/api/src/main.py`
- Create: `apps/web/src/app/sentry.client.config.ts`
- Create: `apps/web/src/app/sentry.server.config.ts`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Update `apps/api/src/main.py`** (Sentry already wired in Task 3 — verify it is present)

Open `apps/api/src/main.py` and confirm the Sentry init block is already there from Task 3. No changes needed if it matches:

```python
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )
```

- [ ] **Step 2: Create `apps/web/src/app/sentry.client.config.ts`**

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Only enable in production to avoid noise in dev
  enabled: process.env.NODE_ENV === "production",
})
```

- [ ] **Step 3: Create `apps/web/src/app/sentry.server.config.ts`**

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
})
```

- [ ] **Step 4: Update `apps/web/next.config.ts`**

```typescript
import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {}

export default withSentryConfig(nextConfig, {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

- [ ] **Step 5: Verify Next.js still builds**

```bash
cd apps/web && pnpm build
```

Expected: build succeeds (Sentry will warn about missing DSN, which is expected in dev).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/main.py apps/web/src/app/sentry.client.config.ts apps/web/src/app/sentry.server.config.ts apps/web/next.config.ts
git commit -m "feat: add Sentry error monitoring (api + web)"
```

---

## Task 10: GitHub Actions + Dependabot

**Files:**
- Create: `.github/workflows/pr.yml`
- Create: `.github/workflows/deploy.yml`
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Create `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule:
      interval: weekly
    groups:
      dev-dependencies:
        dependency-type: development

  - package-ecosystem: pip
    directory: "/apps/api"
    schedule:
      interval: weekly
```

- [ ] **Step 2: Create `.github/workflows/pr.yml`**

```yaml
name: PR Checks

on:
  pull_request:
    branches: [master]

jobs:
  quality:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eggscaliber_dev
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eggscaliber_test
      MIGRATIONS_TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: astral-sh/setup-uv@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pnpm install
          uv sync

      - name: Create test databases and extensions
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE eggscaliber_dev;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE eggscaliber_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE eggscaliber_migrations_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d eggscaliber_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d eggscaliber_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d eggscaliber_migrations_test -c "CREATE EXTENSION IF NOT EXISTS vector;"

      - name: Run migrations (test DB)
        run: cd apps/api && uv run alembic upgrade head
        env:
          DATABASE_URL: ${{ env.TEST_DATABASE_URL }}

      - name: Lint
        run: just lint

      - name: Format check
        run: just format-check

      - name: Type check
        run: just typecheck

      - name: Security audit
        run: just audit

      - name: Check generated types are fresh
        run: just check-types

      - name: Run tests
        run: just test

      - name: Build Storybook (verify no component errors)
        run: cd apps/web && pnpm build-storybook
```

- [ ] **Step 3: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eggscaliber_dev
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eggscaliber_test
      MIGRATIONS_TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - uses: astral-sh/setup-uv@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pnpm install
          uv sync

      - name: Create test databases and extensions
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE eggscaliber_dev;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE eggscaliber_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE eggscaliber_migrations_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d eggscaliber_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d eggscaliber_migrations_test -c "CREATE EXTENSION IF NOT EXISTS vector;"

      - name: Run migrations
        run: cd apps/api && uv run alembic upgrade head
        env:
          DATABASE_URL: ${{ env.TEST_DATABASE_URL }}

      - name: Run all checks and tests
        run: |
          just lint
          just format-check
          just typecheck
          just audit
          just test

      - name: Deploy to Chromatic
        run: cd apps/web && pnpm chromatic --project-token=${{ secrets.CHROMATIC_PROJECT_TOKEN }}

      # Vercel deploys automatically via Vercel GitHub integration — no step needed here.
      # Render deploys automatically via Render GitHub integration — no step needed here.
```

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions PR checks, deploy workflow, and Dependabot"
```

---

## Task 11: External services setup

These are account-creation and configuration steps. No code is written — only credentials gathered for `.env.local`.

- [ ] **Step 1: Create a Neon account and project**

1. Go to `https://neon.tech` → Sign up (free)
2. Create a new project named `eggscaliber-lite`
3. Note the **Connection string** (starts with `postgresql://...@...neon.tech/...`)
4. In the Neon dashboard, create a second branch named `staging`

- [ ] **Step 2: Create a Clerk application**

1. Go to `https://clerk.com` → Sign up (free)
2. Create a new application named `Eggscaliber Lite`
3. Enable **Email + Password** sign-in
4. Copy `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

- [ ] **Step 3: Create a Cloudflare R2 bucket**

1. Go to `https://dash.cloudflare.com` → R2 Object Storage → Create bucket
2. Name the bucket `eggscaliber-lite`
3. Go to **Manage R2 API Tokens** → Create token with `Object Read & Write` on the bucket
4. Copy `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

- [ ] **Step 4: Create a Sentry project**

1. Go to `https://sentry.io` → Sign up (free)
2. Create a project → **FastAPI** platform → name `eggscaliber-api`
3. Copy `SENTRY_DSN`
4. Create a second project → **Next.js** → name `eggscaliber-web`
5. Copy `NEXT_PUBLIC_SENTRY_DSN`

- [ ] **Step 5: Create a PostHog project**

1. Go to `https://app.posthog.com` → Sign up (free)
2. Create a project named `Eggscaliber Lite`
3. Copy `NEXT_PUBLIC_POSTHOG_KEY`

- [ ] **Step 6: Connect Vercel to the repo**

1. Go to `https://vercel.com` → New Project → Import the GitHub repo
2. Set **Root Directory** to `apps/web`
3. Add all `NEXT_PUBLIC_*` environment variables from the steps above
4. Add `CLERK_SECRET_KEY`
5. Deploy — note the production URL

- [ ] **Step 7: Connect Render to the repo**

1. Go to `https://render.com` → New Web Service → Connect GitHub repo
2. Set **Root Directory** to `apps/api`
3. Set **Build Command**: `uv sync`
4. Set **Start Command**: `uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables: `DATABASE_URL` (Neon production connection string), `SENTRY_DSN`, `ENVIRONMENT=production`, `AUTH_MODE=clerk`, `CLERK_SECRET_KEY`
6. Deploy — note the production URL

- [ ] **Step 8: Connect Chromatic to the repo**

1. Go to `https://www.chromatic.com` → Sign in with GitHub → Add project
2. Copy `CHROMATIC_PROJECT_TOKEN`
3. Add `CHROMATIC_PROJECT_TOKEN` as a GitHub Actions secret in repo settings

- [ ] **Step 9: Create `.env.local` with all gathered values**

```bash
# Database (local dev Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_dev
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_test
MIGRATIONS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test

# Auth (dev bypass — no Clerk locally)
AUTH_MODE=dev
DEV_JWT_SECRET=dev-secret-change-in-production

# Storage (local MinIO)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Sentry (optional in dev — leave blank to disable)
# SENTRY_DSN=https://...@sentry.io/...
# NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

ENVIRONMENT=development
```

- [ ] **Step 10: Verify full local dev stack**

```bash
just setup
```

Expected: Docker up, migrations run, types generated, no errors.

```bash
just dev
```

Open `http://localhost:3000` — Next.js home page.
Open `http://localhost:8000/api/v1/health` — `{"status":"ok"}`.
Open `http://localhost:9001` — MinIO console (user: `minioadmin`, pass: `minioadmin`).

---

## Task 12: MCPs configuration

These are Claude Code configuration steps — not git-tracked (MCPs are configured in `~/.claude/` settings).

- [ ] **Step 1: Install GitHub MCP**

In Claude Code, run:
```
/mcp add github
```
Or add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-token>" }
    }
  }
}
```

Create a GitHub Personal Access Token at `https://github.com/settings/tokens` with `repo`, `read:org`, `workflow` scopes.

- [ ] **Step 2: Install Linear MCP**

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@linear/mcp-server"],
      "env": { "LINEAR_API_KEY": "<your-linear-api-key>" }
    }
  }
}
```

Get API key from Linear → Settings → API → Personal API Keys.

- [ ] **Step 3: Install Context7 MCP**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

- [ ] **Step 4: Install Neon MCP**

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": { "NEON_API_KEY": "<your-neon-api-key>" }
    }
  }
}
```

Get API key from Neon dashboard → Account → API Keys.

- [ ] **Step 5: Install Playwright MCP**

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

- [ ] **Step 6: Restart Claude Code and verify MCPs are active**

Run in Claude Code: `What MCPs do you have available?`
Expected: GitHub, Linear, Context7, Neon, Playwright listed alongside the existing Atlassian, IDE, Gmail, Calendar.

---

## Task 13: Documentation

**Files:**
- Modify: `CLAUDE.md`
- Create: `docs/patterns.md`
- Create: `docs/patterns/backend.md`
- Create: `docs/patterns/frontend.md`
- Create: `docs/patterns/infrastructure.md`
- Create: `docs/testing.md`

- [ ] **Step 1: Rewrite `CLAUDE.md`**

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run all commands from the repo root via `just`:

```bash
just setup          # bootstrap: install deps, start Docker, migrate, generate types
just dev            # start api + web concurrently (requires db-up first)
just web            # Next.js dev server (localhost:3000)
just api            # FastAPI dev server (localhost:8000)
just storybook      # Storybook (localhost:6006)
just db-up          # start Docker containers
just db-migrate     # run Alembic migrations
just db-migration "name"  # generate new migration from model changes
just db-reset       # wipe volumes and remigrate
just generate-types # regenerate packages/shared/api.d.ts from OpenAPI spec
just test           # run all tests (pytest + vitest)
just lint           # ruff + eslint
just format         # ruff format + prettier
just typecheck      # ty + tsc
just audit          # pip-audit + pnpm audit
```

Run a single Python test:
```bash
cd apps/api && uv run pytest tests/test_health.py::test_health_returns_ok -v
```

Run a single TS test:
```bash
cd apps/web && pnpm vitest run src/app/page.test.tsx
```

## Architecture

- `apps/api/` — FastAPI backend. Strict 3-layer: `routes/` → `services/` → `repositories/`. See `docs/patterns/backend.md`.
- `apps/web/` — Next.js frontend (App Router). See `docs/patterns/frontend.md`.
- `packages/shared/api.d.ts` — **AUTO-GENERATED** TypeScript types from FastAPI OpenAPI spec. Never edit manually. Run `just generate-types` to regenerate.
- `docker/init/` — SQL bootstrap only (create DBs + extensions). All schema lives in `apps/api/migrations/`.

## Key Conventions

- All API routes prefixed `/api/v1/`
- Commit messages follow Conventional Commits: `feat(scope):`, `fix(scope):`, `chore(scope):` etc. Valid scopes: `api`, `web`, `shared`, `docker`, `ci`, `deps`, `docs`, `notebooks`
- Stories colocated with components: `Button.tsx` + `Button.stories.tsx` in the same directory
- Never add SQLite-based tests — all tests run against the real Postgres test DB
- Never mock the database or internal services — see `docs/testing.md`
- Architecture rules are in `docs/patterns.md` — run `audit-patterns` skill periodically to enforce them

## Environment

- Local dev: `.env.local` (Docker Postgres + MinIO + dev JWT auth)
- All required env vars documented in `.env.example`
```

- [ ] **Step 2: Create `docs/patterns.md`**

```markdown
# Codebase Patterns

Authoritative index of conventions enforced in this codebase. The `audit-patterns` skill reads this file.

## Backend (FastAPI)

Strict 3-layer architecture. **No layer may reach past its immediate neighbour.**

### Route handlers (`apps/api/src/routes/`)
- Validate input with Pydantic/SQLModel schemas
- Call exactly one service method
- Map typed domain errors to HTTP responses
- No business logic, no direct DB access

```python
# CORRECT
@router.post("/datasets", status_code=201)
async def create_dataset(
    payload: DatasetCreate,
    session: Session = Depends(get_session),
) -> DatasetRead:
    try:
        return dataset_service.create(session, payload)
    except DatasetAlreadyExistsError:
        raise HTTPException(status_code=409, detail="Dataset already exists")

# WRONG — business logic in route handler
@router.post("/datasets")
async def create_dataset(payload: DatasetCreate, session: Session = Depends(get_session)):
    existing = session.exec(select(Dataset).where(Dataset.name == payload.name)).first()
    if existing:
        raise HTTPException(...)
```

### Services (`apps/api/src/services/`)
- All business logic lives here
- Raise typed domain errors (not HTTPException)
- No raw SQL, no HTTP concerns

```python
class DatasetAlreadyExistsError(Exception): ...

class DatasetService:
    def create(self, session: Session, payload: DatasetCreate) -> Dataset:
        if dataset_repo.get_by_name(session, payload.name):
            raise DatasetAlreadyExistsError(payload.name)
        return dataset_repo.create(session, payload)
```

### Repositories (`apps/api/src/repositories/`)
- All database queries
- Return domain models (SQLModel instances)
- No business logic

```python
class DatasetRepository:
    def get_by_name(self, session: Session, name: str) -> Dataset | None:
        return session.exec(select(Dataset).where(Dataset.name == name)).first()
```

See full detail: [docs/patterns/backend.md](patterns/backend.md)

## Frontend (Next.js)

See [docs/patterns/frontend.md](patterns/frontend.md)

## Infrastructure

See [docs/patterns/infrastructure.md](patterns/infrastructure.md)
```

- [ ] **Step 3: Create `docs/patterns/backend.md`**

```markdown
# Backend Patterns

## 3-Layer Architecture

Layer order: `routes/` → `services/` → `repositories/`. No skipping.

## File Naming

- Route files match the resource: `datasets.py`, `collections.py`
- Service files: `dataset_service.py`
- Repository files: `dataset_repo.py`
- Domain error classes defined in `src/errors.py`

## Models

SQLModel is used for both Pydantic validation and SQLAlchemy ORM. Three model variants per entity:

```python
class DatasetBase(SQLModel):
    name: str
    description: str | None = None

class Dataset(DatasetBase, table=True):  # DB model
    id: int | None = Field(default=None, primary_key=True)

class DatasetCreate(DatasetBase): ...    # input schema
class DatasetRead(DatasetBase):          # output schema
    id: int
```

## Error Handling

Define typed errors in `src/errors.py`:

```python
class DomainError(Exception): ...
class DatasetAlreadyExistsError(DomainError): ...
class DatasetNotFoundError(DomainError): ...
```

Routes catch these and map to HTTP codes. Never raise `HTTPException` in services.

## Adding Models to Alembic

After adding a new SQLModel `table=True` class, always:

1. Import the model in `migrations/env.py` (see the comment block)
2. Run `just db-migration "describe the change"`
3. Review the generated migration — ensure `downgrade()` reverses `upgrade()` exactly
4. Run `just test-api` to confirm all 3 migration tests pass
```

- [ ] **Step 4: Create `docs/patterns/frontend.md`**

```markdown
# Frontend Patterns

## Data Fetching

Use `openapi-fetch` with the generated types from `packages/shared/api.d.ts`:

```typescript
import createClient from "openapi-fetch"
import type { paths } from "@shared/api"

const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL })

const { data, error } = await api.GET("/api/v1/datasets")
```

Never use raw `fetch` for API calls — always go through the typed client.

## Component Structure

Stories colocated with components:

```
src/components/ui/
  Button.tsx
  Button.stories.tsx   ← same directory, not in a separate stories/ folder
  Button.test.tsx      ← unit tests alongside the component (if needed)
```

## Feature Flags

Use PostHog for feature flags:

```typescript
import { useFeatureFlagEnabled } from "posthog-js/react"

function MyComponent() {
  const showNewFeature = useFeatureFlagEnabled("new-feature-flag")
  return showNewFeature ? <NewFeature /> : <OldFeature />
}
```

## State Management

Prefer React Server Components and URL state (searchParams) for server-rendered data. Use `useState`/`useReducer` for local UI state. Avoid global client state (Redux, Zustand) unless genuinely needed.
```

- [ ] **Step 5: Create `docs/patterns/infrastructure.md`**

```markdown
# Infrastructure Patterns

## Environment Variables

All env vars must be documented in `.env.example` before use. Never access `process.env` in Python — use `src/config.py` Settings. Never access env vars directly in TS components — use Next.js env var conventions (`NEXT_PUBLIC_` prefix for client-side).

## Docker

Two named volumes: `postgres_data`, `minio_data`. Never use bind mounts for service data.

Init scripts in `docker/init/` bootstrap only (create DBs, install extensions). All schema is managed by Alembic.

## Migrations

Always generate migrations with `just db-migration "describe change"`. Never write migrations by hand unless autogenerate cannot detect the change. Always implement `downgrade()` — it is tested in CI.

After any model change, run `just test-api` before committing to ensure all 3 migration tests pass.

## CI

Two workflows:
- `pr.yml` — runs on every PR, must pass before merge
- `deploy.yml` — runs on merge to master, deploys to Chromatic (Storybook); Vercel and Render deploy automatically via their GitHub integrations
```

- [ ] **Step 6: Create `docs/testing.md`**

```markdown
# Testing Standards

## Core Principles

**Integration-first.** Tests run against the real `eggscaliber_test` Postgres database — same container, different DB name. Never use SQLite. No dialect mismatch, full pgvector support.

**Test real behaviour.** Tests should catch real bugs. Do not write tests that only assert values you set up, or that verify internal functions were called.

**No unnecessary mocking.** Only mock at true external boundaries:
- External HTTP APIs (third-party services)
- Clerk authentication (in tests, use `AUTH_MODE=dev` and a dev JWT)
- Cloudflare R2 (use a test bucket or skip storage assertions in unit tests)

Never mock: the database, internal services, repositories.

## Transaction Rollback Isolation

Every test runs inside a transaction that is rolled back on teardown. This means:
- No test data leaks between tests
- Tests can run in parallel safely
- No `DELETE FROM` teardown needed

The fixtures in `apps/api/tests/conftest.py` implement this pattern. Use them — do not create your own engine/session fixtures.

## Fixture Scopes

| Fixture | Scope | Purpose |
| --- | --- | --- |
| `engine` | session | one engine for the whole test run |
| `db` | function | transaction-wrapped session, rolled back after each test |
| `client` | function | TestClient with `get_session` overridden to use `db` |

## Migration Tests

Three tests in `tests/test_migrations.py` run as part of every test suite:

1. `test_single_migration_head` — linear history, no branches
2. `test_no_pending_model_changes` — all model changes have a migration
3. `test_migration_upgrade_downgrade_cycle` — full cycle on dedicated migrations DB

These run in CI before any other tests (migrations are applied to `eggscaliber_test` first).

## Naming Conventions

```python
def test_<thing>_<condition>_<expected_outcome>():
    ...

# Examples:
def test_create_dataset_with_duplicate_name_raises_409(): ...
def test_health_returns_ok(): ...
def test_cross_tab_with_no_data_returns_empty_table(): ...
```

## Test Data

Use fixtures for frequently reused test data. Define them in `conftest.py` with `scope="function"` so they are rolled back with the transaction.

```python
@pytest.fixture
def sample_dataset(db):
    dataset = Dataset(name="test-dataset", description="For testing")
    db.add(dataset)
    db.flush()  # assigns ID without committing
    return dataset
```

Call `db.flush()` (not `db.commit()`) to get IDs assigned while keeping the transaction open for rollback.
```

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: add CLAUDE.md, patterns, and testing standards"
```

---

## Task 14: End-to-end verification

Verify all the "done when" criteria from the spec are met.

- [ ] **Step 1: Run full local test suite**

```bash
just test
```

Expected: all pytest and vitest tests pass.

- [ ] **Step 2: Run full quality gate**

```bash
just lint && just format-check && just typecheck && just audit
```

Expected: all pass with no errors.

- [ ] **Step 3: Verify `just check-types` passes**

```bash
just check-types
```

Expected: exit 0, no output.

- [ ] **Step 4: Push to GitHub and verify CI passes**

```bash
git push origin master
```

Go to GitHub → Actions — verify the `Deploy` workflow runs and passes.

- [ ] **Step 5: Verify Vercel deployment**

Open the Vercel-assigned URL (from Task 11, Step 6). Expect the "Eggscaliber-Lite" heading to appear.

- [ ] **Step 6: Verify Render deployment**

Open `<render-url>/api/v1/health`. Expect `{"status":"ok"}`.

- [ ] **Step 7: Deploy Storybook to Chromatic manually (first time)**

```bash
cd apps/web && pnpm chromatic --project-token=$CHROMATIC_PROJECT_TOKEN
```

Expected: Chromatic URL printed. Open it — expect to see all 5 component stories and the Design System/Tokens stories.

- [ ] **Step 8: Create a test PR to verify the PR workflow**

```bash
git checkout -b test/verify-pr-workflow
echo "# test" >> README.md
git add README.md
git commit -m "chore(ci): test PR workflow"
git push origin test/verify-pr-workflow
```

Open a PR on GitHub. Wait for `PR Checks` workflow to complete. Expected: all steps green.

- [ ] **Step 9: Close the test PR without merging, delete the branch**

```bash
git checkout master
git branch -d test/verify-pr-workflow
git push origin --delete test/verify-pr-workflow
```

- [ ] **Step 10: Set up GitHub branch protection**

In GitHub → repo Settings → Branches → Add rule:
- Branch name pattern: `master`
- Check: **Require a pull request before merging**
- Check: **Require status checks to pass** → select `quality` (the job name from `pr.yml`)
- Check: **Do not allow bypassing the above settings**

- [ ] **Step 11: Final commit confirming foundation is complete**

```bash
git add -A
git status  # should be clean or only untracked files
git commit -m "chore: project foundation complete — all services live, CI green, design system deployed" --allow-empty
```

---

## Self-Review Checklist

### Spec coverage

| Spec requirement | Covered by |
| --- | --- |
| Monorepo (pnpm + uv) | Task 1 |
| Docker local dev (2 containers) | Task 2 |
| justfile all commands from root | Task 2 |
| FastAPI skeleton `/api/v1/` | Task 3 |
| SQLModel + Alembic | Task 4 |
| 3 migration tests | Task 4 |
| Code quality (ruff, ty, eslint, prettier) | Task 5 |
| Pre-commit hooks (husky + lint-staged + commitlint) | Task 5 |
| Next.js skeleton | Task 6 |
| Design tokens (Tailwind + CSS vars) | Task 6 |
| 5 atomic components with stories | Task 7 |
| Storybook | Task 7 |
| Shared types (OpenAPI → TS) | Task 8 |
| Sentry (api + web) | Task 9 |
| GitHub Actions PR + deploy workflows | Task 10 |
| Dependabot | Task 10 |
| Security audit (`pip-audit` + `pnpm audit`) | Task 5 + Task 10 |
| Neon, Clerk, R2, Vercel, Render, Chromatic, PostHog, Sentry accounts | Task 11 |
| MCPs (GitHub, Linear, Context7, Neon, Playwright) | Task 12 |
| CLAUDE.md, patterns.md, testing.md | Task 13 |
| `.editorconfig` | Task 1 |
| `.env.example` | Task 1 |
| Branch protection | Task 14 |
| API versioning `/api/v1/` | Task 3 |
| Transaction rollback test isolation | Task 3 (conftest.py) |
| Dev JWT auth bypass | Task 3 (config.py) |
| Two test databases | Task 2 |
| named Docker volumes | Task 2 |
| pgvector extension | Task 2 |

All spec requirements covered.
