# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Always run commands via `just <command>` from the repo root.** Do not invoke tools directly (e.g. use `just test-api` not `cd apps/api && uv run pytest`). The justfile loads `.env.local` automatically via `set dotenv-load`.

Check `just --list` for all available commands. Only fall back to direct invocation when no `just` recipe covers the operation (e.g. `pnpm install`, `uv sync`, `git` operations).

When running `uv run` directly (not via `just`), add `--no-env-file` to prevent uv from looking for a `.env` file — `just` already loads `.env.local` and exports those vars.

```bash
just setup          # bootstrap: install deps, start Docker, migrate, generate types
just dev            # start api + web concurrently
just web            # Next.js dev server (localhost:3000)
just api            # FastAPI dev server (localhost:8000)
just storybook      # Storybook (localhost:6006)
just db-up          # start Docker containers
just db-migrate     # run Alembic migrations
just db-migration "name"  # generate new migration from model changes
just db-reset       # wipe volumes and remigrate
just generate-types # regenerate packages/shared/api.d.ts from OpenAPI spec
just test           # run all tests (pytest + vitest)
just test-api       # pytest only
just test-web       # vitest only
just lint           # ruff + biome
just format         # ruff format + biome format
just format-check   # check formatting without writing (CI)
just typecheck      # ty + tsc
just audit          # pip-audit + pnpm audit
```

## Architecture

- `apps/api/` — FastAPI backend. Strict 3-layer: `routes/` → `services/` → `repositories/`. See `docs/patterns/backend.md`.
- `apps/web/` — Next.js frontend (App Router). See `docs/patterns/frontend.md`.
- `packages/shared/api.d.ts` — **AUTO-GENERATED** TypeScript types from FastAPI OpenAPI spec. Never edit manually. Run `just generate-types`.
- `docker/init/` — SQL bootstrap only (create DBs + extensions). All schema lives in `apps/api/migrations/`.

## Key Conventions

- All API routes prefixed `/api/v1/`
- Commit messages follow Conventional Commits: `feat(scope):`, `fix(scope):`, `chore(scope):` etc. Valid scopes: `api`, `web`, `shared`, `docker`, `ci`, `deps`, `docs`, `notebooks`
- Stories colocated with components: `Button.tsx` + `Button.stories.tsx` in the same directory
- Never add SQLite-based tests — all tests run against the real Postgres test DB
- Never mock the database or internal services — see `docs/testing.md`
- Architecture rules are in `docs/patterns.md` — run `audit-patterns` skill periodically

## Skills

Agent skills live in `.claude/skills/`. After running `uv sync`, re-sync the FastAPI bundled skill:

```bash
cp -r .venv/lib/python3.13/site-packages/fastapi/.agents/skills/fastapi .claude/skills/fastapi
```

## Adding New Libraries

When adding any library or framework, **always** do one of the following before writing any integration code:

1. **Search for an existing skill** on [skills.sh](https://skills.sh) from the library's official org. If found and audits pass (Gen ✅, Socket ✅, Snyk ✅/⚠️), install it: `npx skills add <owner/repo> --skill <name> --agent claude-code -y`
2. **Write a custom skill** by reading the official docs for the installed version via `WebFetch`. Save to `.claude/skills/<library>/SKILL.md` and commit.

Do not rely on training-data knowledge for installation or integration — always read current docs.



1. **Use the latest stable version** — confirm with `npm show <pkg> version` or `uv pip index versions <pkg>`. Do not use version numbers from training data.
2. **Read the official docs for that exact version** before writing any config or integration code. Use `WebFetch`/`WebSearch` — don't assume the API from memory.
3. **Check for patterns worth documenting** — if the library's best-practice setup reveals conventions relevant to this project, add them to `docs/patterns/` (frontend, backend, or infrastructure as appropriate).

This rule exists because version-specific breakage has already occurred: Storybook 8→10 changed the framework entirely, `next lint` was removed in Next.js 16, `eslint-plugin-react` v7 is incompatible with ESLint 10. Each was avoidable by reading current docs.

## Environment

- Local dev: `.env.local` (Docker Postgres + MinIO + dev JWT auth)
- All required env vars documented in `.env.example`
