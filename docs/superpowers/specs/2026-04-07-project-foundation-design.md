# Project Foundation Design

**Date:** 2026-04-07  
**Project:** Eggscaliber-Lite  
**Scope:** Sub-project 1 of 5 — dev environment, tech stack, monorepo structure, AI workflow, product roadmap

---

## Overview

Eggscaliber-Lite is a data analysis platform that enables users to connect to data sources, perform cross-tab and trending analytics, and query data using natural language. This spec covers only the project foundation — the scaffolding everything else is built on.

**Context:** Solo project, full-stack developer (Python + JS), light on AI tooling. All user types in scope (from technical analysts to non-technical business users). Prototype-first with a clear path to production.

---

## Tech Stack

### Frontend
| Concern | Choice | Hosting |
|---|---|---|
| Framework | Next.js (App Router) | Vercel (free) |
| Components | shadcn/ui + Tailwind CSS | — |
| Charts | Recharts | — |
| AI streaming | Vercel AI SDK | — |
| Feature flags + analytics | PostHog | Free tier |
| Design system + prototyping | Storybook + Chromatic | Chromatic free tier |

### Backend
| Concern | Choice | Hosting |
|---|---|---|
| Framework | FastAPI (Python) | Render (free, spins down) |
| ORM + models | SQLModel (Pydantic + SQLAlchemy unified) | — |
| Migrations | Alembic | — |
| Package management | uv | — |
| AI orchestration | PydanticAI (multi-provider) | — |
| Notebooks | Marimo | Local only |

### Data & Auth
| Concern | Production | Local Dev |
|---|---|---|
| Database | Neon (serverless Postgres + pgvector) | `pgvector/pgvector:pg16` container |
| Auth | Clerk | Dev JWT mock (env-variable swapped) |
| File storage | Cloudflare R2 (S3-compatible) | MinIO container (S3-compatible) |

### Tooling
| Concern | Choice |
|---|---|
| Project management | Linear (free solo tier) |
| CI/CD | GitHub Actions |
| Monorepo (JS) | pnpm workspaces |
| Monorepo (Python) | uv workspace |
| Task runner | justfile (run everything from root) |

---

## Local Dev Environment

Two Docker containers only — no Supabase local dev stack:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data  # named volume, persists across restarts
  minio:
    image: minio/minio
    volumes:
      - minio_data:/data  # named volume

volumes:
  postgres_data:
  minio_data:
```

Auth in local dev uses a dev JWT bypass — FastAPI accepts tokens signed with a known dev secret, controlled by `AUTH_MODE=dev` in `.env.local`. This means no identity provider container is needed locally.

SQL init scripts in `docker/init/` run on first container start and are committed to git. They handle container bootstrap only — creating databases and installing extensions. All schema is managed by Alembic migrations, not init scripts.

Init scripts create two databases:
- `eggscaliber_dev` — development database (pointed to by `.env.local`)
- `eggscaliber_test` — test database (pointed to by pytest config)

**Migrations — SQLModel + Alembic:**
- SQLModel unifies Pydantic and SQLAlchemy models into one class — no duplication between API schemas and DB models
- Migration files live in `apps/api/migrations/`
- `just db-migrate` runs `alembic upgrade head` against the dev database
- CI runs `alembic upgrade head` against the test database before running any tests
- Neon: migrations run as part of the Render deploy step before the new API version starts serving traffic

**Volume management:**
- `just db-reset` — drops and recreates named volumes (clean slate), then re-runs init scripts
- `just db-seed` — runs seed scripts against the dev database

---

## Monorepo Structure

```
eggscaliber-lite/
├── apps/
│   ├── web/                    # Next.js (App Router)
│   │   ├── src/app/
│   │   ├── src/components/     # *.stories.tsx colocated alongside each component
│   │   └── .storybook/
│   └── api/                    # FastAPI
│       ├── src/
│       ├── tests/
│       └── pyproject.toml
├── packages/
│   └── shared/                 # AUTO-GENERATED — do not edit manually
│       └── api.d.ts            # TypeScript types generated from FastAPI OpenAPI spec
├── notebooks/                  # Marimo notebooks
├── docker/
│   └── init/                   # SQL init scripts (schema, extensions, seeds)
├── .github/
│   └── workflows/              # GitHub Actions CI
├── docker-compose.yml
├── justfile                    # All commands run from here
├── pyproject.toml              # uv workspace root
├── package.json                # pnpm workspace root
├── CLAUDE.md
└── .env.example                # Committed — no secrets, all keys documented
```

### Shared Types: FastAPI → OpenAPI → TypeScript

Python (Pydantic) is the **single source of truth** for all API types. TypeScript types are auto-generated — never written by hand.

```
Pydantic model in apps/api/
  → FastAPI serves /openapi.json
  → just generate-types          (runs openapi-typescript)
  → packages/shared/api.d.ts     (committed to git)
  → consumed in apps/web/ via openapi-fetch (fully typed HTTP client)
```

`packages/shared` is committed to git so type drift between API changes and the frontend is visible in PRs. CI fails if the generated types are stale.

### justfile Commands

```just
# Development
dev:         # docker up + api + web concurrently
web:         # Next.js dev server only
api:         # FastAPI dev server (uvicorn --reload)
storybook:   # Storybook dev server
notebook:    # Marimo server

# Database
db-up:       # start docker containers
db-reset:    # drop + recreate named volumes
db-seed:     # run seed scripts
db-migrate:  # run pending migrations

# Types
generate-types:  # regenerate packages/shared from /openapi.json
check-types:     # fail if generated types are stale (used in CI)

# Quality
test:        # pytest (api) + vitest (web)
lint:        # ruff check + eslint
format:      # ruff format + prettier
typecheck:   # ty check (api) + tsc --noEmit (web)
audit:       # pip-audit (api) + pnpm audit (web)
```

### Environment Files

```
.env.local       # local dev — Postgres + MinIO + dev JWT secret
.env.staging     # Neon + Clerk + R2 (staging Neon branch)
.env.production  # Neon + Clerk + R2 (production)
.env.example     # committed, documents all required keys
```

---

## Code Quality & Standards

### Documentation Structure

```
docs/
├── patterns.md          # Index + inline rules (read by audit-patterns skill)
├── patterns/
│   ├── backend.md       # 3-layer architecture detail
│   ├── frontend.md      # Component patterns, data fetching, state
│   └── infrastructure.md # Docker, CI, env config patterns
└── testing.md           # Testing standards and fixture patterns
```

`docs/patterns.md` is the authoritative index — the `audit-patterns` skill reads it to actively audit the codebase, flag deviations, and suggest fixes. Detail files are linked from the index.

### Backend Patterns (3-layer architecture)

Strict separation — no layer may reach past its neighbour:

- **Route handlers** (`apps/api/src/routes/`) — validate input (Pydantic models), call one service method, map domain errors to HTTP responses. No business logic, no direct DB access.
- **Services** (`apps/api/src/services/`) — all business logic. Raise typed domain errors (custom exception classes). No HTTP concerns, no raw SQL.
- **Repositories** (`apps/api/src/repositories/`) — all database queries. Return domain models. No business logic.

### Testing Standards

**What to test:** Core functionality and realistic edge cases. Tests should catch real bugs, not assert setup values or verify that functions were called.

**Integration-first:** Tests run against the real `eggscaliber_test` Postgres database (same container as dev, different DB name). No dialect mismatch, no mocked queries, full pgvector support.

**Test isolation:** Each test runs inside a transaction that is rolled back on teardown — no table truncation needed, safe for parallel execution. Fixtures use `scope="session"` for the DB connection and `scope="function"` for the transaction wrapper.

**No unnecessary mocking:** Only mock at true system boundaries — external HTTP APIs, Clerk auth, Cloudflare R2. Never mock the database, never mock internal services just to test a route handler in isolation.

**Migration tests** — the following run as part of the standard test suite:

1. **Linear history check** — asserts `alembic heads` returns exactly one entry. Fails if two migrations were branched off the same base (e.g. from a bad merge). Does not require a DB connection.
2. **Model/migration sync check** — asserts `alembic check` produces no new autogenerated changes. Catches model fields added without a corresponding migration.
3. **Full cycle test** — against the test DB: `upgrade head` → `downgrade base` → `upgrade head`. Verifies all up and down migrations apply cleanly end-to-end.

**CI:** GitHub Actions runs the `pgvector/pgvector:pg16` container as a service, applies migrations to the test DB, then runs all tests including the migration tests above.

### Linting, Formatting & Type Checking

**Python toolchain — all Astral (uv + ruff + ty):**

| Tool | Purpose |
|---|---|
| `ruff check` | Linting (replaces flake8, isort, pylint) |
| `ruff format` | Formatting (replaces black) |
| `ty check` | Type checking — Rust-based, fast. Note: released April 2025, still maturing. If SQLModel/Pydantic generic inference proves unreliable, fall back to pyright. |

**TypeScript toolchain:**

| Tool | Purpose |
|---|---|
| `eslint` | Linting |
| `prettier` | Formatting |
| `tsc --noEmit` | Type checking |

**Pre-commit hooks — husky + lint-staged + commitlint:**

Two hook types:

- `pre-commit` (staged files only, fast):
  - Python files → `ruff check --fix` + `ruff format`
  - TS/TSX files → `eslint --fix` + `prettier --write`
  - Any dependency file changed (`pyproject.toml`, `pnpm-lock.yaml`) → `pip-audit` + `pnpm audit`
- `commit-msg` → `commitlint` enforces Conventional Commits format (e.g. `feat(api): add cross-tab endpoint`)

Blocks the commit on errors that cannot be auto-fixed (type errors, real lint violations, audit vulnerabilities, malformed commit messages).

**Conventional Commits** map to Linear automatically — a commit message referencing `EGG-42` transitions the ticket and links the commit. Enables automated changelog generation.

**GitHub Actions — two workflows:**

*On every PR:*
- Lint + format check (`ruff` + `eslint`/`prettier`)
- Type check (`ty` + `tsc --noEmit`)
- Security audit (`pip-audit` + `pnpm audit`) — fails on high/critical CVEs
- `just check-types` — generated OpenAPI types are fresh
- Full test suite (pytest + vitest) with pgvector container
- Migration tests (linear history + model sync + full cycle)

*On merge to main:*
- All of the above, plus deploy to Vercel preview / Render staging

**Branch protection on `master`:** Require PR, all status checks must pass, no direct pushes.

**Dependabot** (`.github/dependabot.yml`): automated PRs for security updates across npm and Python packages.

`just lint`, `just format`, `just typecheck`, and `just audit` all run both Python and TypeScript from the root.

---

### Additional Practices

**Sentry** — error monitoring in both FastAPI (sentry-sdk) and Next.js (@sentry/nextjs). Free tier. Captures unhandled exceptions with stack traces and request context. Set up from day one — errors in staging and production are visible immediately without digging through logs.

**API versioning** — all FastAPI routes mounted under `/api/v1/`. No version negotiation complexity for a prototype, but avoids a painful rename later when a breaking change is needed.

**`.editorconfig`** — committed to root, enforces consistent indentation (2 spaces JS/TS, 4 spaces Python) and line endings across editors.

**Deferred to sub-project 5 (AI Interface):**
- Rate limiting on AI endpoints — cost protection for LLM calls
- OpenTelemetry tracing — visibility into which data sources are queried, LLM latency per tool call

---

## Design System

Storybook is both the component library and the design documentation. It replaces a separate design tool.

**Structure:**
- `tailwind.config.ts` — design tokens (colour palette, spacing scale, typography)
- `src/app/globals.css` — semantic CSS variables (`--primary`, `--destructive`, `--muted`, etc.) that shadcn/ui uses
- `src/components/ui/` — shadcn/ui atomic components, customised to the design system
- `src/components/` — each component has a colocated `Component.stories.tsx`; a dedicated `Design System` section in Storybook documents tokens and atoms

**Workflow:** I build components and stories. You review at `localhost:6006` or on Chromatic (hosted, shareable links). Feedback drives iteration. Feature flag variants are toggleable per-story via PostHog.

---

## AI Development Workflow

### MCPs to Configure

| MCP | Purpose |
|---|---|
| GitHub | Create issues, review PRs, check CI — without leaving Claude Code |
| Linear | Create and update tickets, read issue context during implementation, transition status, link to PRs |
| Context7 | Fetch up-to-date library docs (Next.js, FastAPI, shadcn, PydanticAI) — prevents hallucinated APIs |
| Neon | Query and manage the database, manage PR branches directly |
| Playwright | Drive a browser for E2E tests and visual verification after implementation |
| *(already installed)* Atlassian, IDE, Gmail, Calendar | — |

### Per-Feature Workflow

For every new feature:
1. **brainstorming** skill → design + spec
2. **writing-plans** skill → implementation plan
3. **using-git-worktrees** skill → isolated branch
4. **test-driven-development** skill → write tests first
5. **executing-plans** skill → implement
6. **verification-before-completion** skill → confirm it works
7. **requesting-code-review** skill → review + PR

### CLAUDE.md Conventions
- All commands via `just <command>` from root
- `packages/shared` is generated — never edit manually, run `just generate-types`
- Stories colocated with components (`Component.stories.tsx` alongside `Component.tsx`)
- SQL schema managed by Alembic — never edit `docker/init/` for schema changes
- All env vars documented in `.env.example`
- Commit messages follow Conventional Commits (`feat`, `fix`, `chore`, etc.)
- All API routes prefixed `/api/v1/`
- Architecture rules in `docs/patterns.md` — run `audit-patterns` skill periodically
- Testing rules in `docs/testing.md` — no SQLite, no unnecessary mocks, transaction rollback isolation

---

## Product Roadmap

Each sub-project gets its own spec → plan → implementation cycle.

### Sub-project 1: Project Foundation *(this spec)*
Scaffold the monorepo, configure all services, set up MCPs, establish design system foundations (tokens + 5 atomic components), CI pipeline, justfile.  
**Done when:** Hello-world running on all services, design system deployed to Chromatic, CI green.

### Sub-project 2: Nomenclature & Data Model
Land on the naming hierarchy for data entities, define all field types (numeric, ordinal, multi-response variants), design the Postgres schema, establish the migration system.  
**Done when:** Schema finalised, seed data representing 2–3 real dataset structures, OpenAPI types generated.

### Sub-project 3: Analytics Engine
Cross-tab and trending queries against seed data, table + chart output components, query builder UI, working prototype deployed and accessible via feature flag.  
**Done when:** End-to-end — select dataset → configure analysis → view table + chart — deployed to Vercel/Render.

### Sub-project 4: Data Ingestion & Metadata Editor
File upload (CSV, SPSS), metadata GUI (field types, display names, multi-response config), template from previous dataset instance. Analytics engine serves as the immediate testbed.  
**Done when:** Upload a real dataset → configure metadata → query it in the analytics engine.

### Sub-project 5: AI Interface
NL query → PydanticAI identifies relevant data sources → executes queries in parallel → streams structured results (text + tables + charts) to frontend via Vercel AI SDK. Responses grounded in real data only — no LLM world knowledge.  
**Done when:** Ask "how has X changed over 5 years?" → receive a cited, data-grounded response with tables and charts.

---

## Production Path

When the prototype is ready to harden:
- Render free tier → Render paid (or Railway) for always-on backend
- Neon free tier → Neon paid for higher compute/storage
- Cloudflare R2 stays the same (very generous free tier)
- Clerk free tier → Clerk paid when MAU limit is reached
- Add a staging environment (Neon branch + Vercel preview deployment per PR)
