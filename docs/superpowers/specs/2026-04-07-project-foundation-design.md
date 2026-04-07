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

SQL init scripts in `docker/init/` run on first container start and are committed to git (schema, `CREATE EXTENSION vector`, seed data).

**Volume management:**
- `just db-reset` — drops and recreates named volumes (clean slate)
- `just db-seed` — runs seed scripts against the running container

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
```

### Environment Files

```
.env.local       # local dev — Postgres + MinIO + dev JWT secret
.env.staging     # Neon + Clerk + R2 (staging Neon branch)
.env.production  # Neon + Clerk + R2 (production)
.env.example     # committed, documents all required keys
```

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
- SQL migrations committed to `docker/init/`
- All env vars documented in `.env.example`

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
