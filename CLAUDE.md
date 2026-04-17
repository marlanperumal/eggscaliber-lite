# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**`just` commands are pre-approved and MUST always be used when a recipe exists.** Using the raw equivalent (e.g. `cd apps/api && uv run pytest` instead of `just test-api`) is never acceptable — it may require manual approval and block progress, and it violates this rule regardless. Check `just --list` before reaching for any direct invocation. Only fall back when no recipe covers the operation.

When no `just` recipe exists, target everything from the repo root:
- **pnpm workspace** — use `--filter` from root: `pnpm --filter web run build`; for packages use `just add-web-dep` / `just add-web-dev-dep`
- **uv one-off** — use `--project` from root: `uv run --project apps/api <cmd>`; for packages use `just add-api-dep` / `just add-api-dev-dep`

**Bash rules:**
- Never `cd` into a subdirectory — target everything from root
- Never start a Bash call with a `#` comment — it blocks auto-approval
- Never use `git -C` — fix the cwd with `cd` first
- `git add` and `git commit` must be separate Bash calls; write the message to `/tmp/commit-msg.txt` with the Write tool, then `git commit -F /tmp/commit-msg.txt`
- Keep calls simple — no complex quoting or chaining
- When hitting local API endpoints, use `curl`; never pipe output to a shell (`| bash`, `| sh`)
- Do not create new `just` recipes to work around approval gates — discuss first

**Prefer dedicated tools over Bash:** `Glob` (search files) · `Grep` (search content) · `Read` · `Edit` · `Write`

```bash
just add-api-dep <package>      # add runtime dep to apps/api
just add-api-dev-dep <package>  # add dev dep to apps/api
just add-web-dep <package>      # add runtime dep to apps/web
just add-web-dev-dep <package>  # add dev dep to apps/web

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
just test-api       # pytest only (accepts extra args, e.g. just test-api -k test_name)
just test-web       # vitest only (accepts extra args, e.g. just test-web -t "test name")
just lint           # ruff + biome
just lint-fix       # apply safe + unsafe lint auto-fixes (ruff + biome)
just format         # ruff format + biome format
just format-check   # check formatting without writing (CI)
just typecheck      # ty + tsc
just audit          # pip-audit + pnpm audit
```

## Architecture

- `apps/api/` — FastAPI backend. Strict 3-layer: `routes/` → `services/` → `repositories/`. See `docs/patterns/backend.md`.
- `apps/web/` — Next.js frontend (App Router). See `docs/patterns/frontend.md`.
- `apps/web/src/config/theme.config.ts` — Design system config. Contains named theme presets (`themes.orange`, `themes.steel`); change the `themeConfig` export to switch palette. See `docs/patterns/design-system.md`.
- `packages/shared/api.d.ts` — **AUTO-GENERATED** TypeScript types from FastAPI OpenAPI spec. Never edit manually. Run `just generate-types`.
- `docker/init/` — SQL bootstrap only (create DBs + extensions). All schema lives in `apps/api/migrations/`.

## MCP Server

The API exposes an MCP server at `http://localhost:8000/mcp` (streamable HTTP). When `just dev` or `just api` is running, the `eggscaliber` MCP server is available directly in Claude Code sessions — use its tools for interactive debugging and data exploration instead of writing curl commands.

Exposed tags: `packages`, `scope`, `collections`, `datasets`, `analytics`. See `docs/patterns/backend.md` for wiring details and the docstring requirement for MCP-exposed routes.

## Key Conventions

- All API routes prefixed `/api/v1/`
- Commit messages follow Conventional Commits: `feat(scope):`, `fix(scope):`, `chore(scope):` etc. Valid scopes: `api`, `web`, `shared`, `docker`, `ci`, `deps`, `docs`, `notebooks`
- Stories colocated with components: `Button.tsx` + `Button.stories.tsx` in the same directory
- Never add SQLite-based tests — all tests run against the real Postgres test DB
- Never mock the database or internal services — see `docs/testing.md`
- Architecture rules are in `docs/patterns.md` — run `audit-patterns` skill periodically
- Frontend styling uses a token-based design system — see `docs/patterns/design-system.md`. Never use raw hex values or `text-primary` as a text colour. Never write `dark:` overrides — tokens handle both modes. Every new component needs a Storybook story with a11y passing.
- Test locators: use `data-testid` on structural containers (chip wrappers, list rows, panel regions); use `getByRole`/`getByText` for assertions about interactive elements and visible content. Never locate by CSS class. See `docs/testing.md`.

## Skills

Agent skills live in `.claude/skills/`. After running `uv sync`, re-sync the FastAPI bundled skill:

```bash
cp -r .venv/lib/python3.13/site-packages/fastapi/.agents/skills/fastapi .claude/skills/fastapi
```

## Adding New Libraries

Before writing any integration code for a new library or framework:

1. **Confirm the latest stable version** — `npm show <pkg> version` or `uv pip index versions <pkg>`. Never use version numbers from training data.
2. **Search for an existing skill** on [skills.sh](https://skills.sh) from the library's official org. If found and audits pass (Gen ✅, Socket ✅, Snyk ✅/⚠️), install it: `npx skills add <owner/repo> --skill <name> --agent claude-code -y`
3. **Otherwise write a custom skill** — read the official docs for the installed version via `WebFetch`/`WebSearch`. Save to `.claude/skills/<library>/SKILL.md` and commit.
4. **Check for patterns worth documenting** — add any relevant conventions to `docs/patterns/`.

## Prototyping Workflow (Brainstorming → Implementation)

Use a **hybrid approach** for UI work — HTML display-server mockups for high-level layout decisions, then implement directly in Storybook. No throwaway code after the design phase.

- **HTML mockups** (via `just brainstorm`): used only for structural/visual direction questions during brainstorming
- **Storybook** (`just storybook`): the implementation target — build stateful stories that serve as both interactive prototype and reference artefact
- Run the `frontend-design` skill during the Storybook implementation phase
- Every new component needs a Storybook story with a11y passing before the task is complete

## Environment

- Local dev: `.env.local` (Docker Postgres + MinIO + dev JWT auth)
- All required env vars documented in `.env.example`

## Production Infrastructure

| Service | Platform | URL |
|---------|----------|-----|
| Web | Vercel | https://eggscaliber-lite-web.vercel.app |
| API | Render | https://eggscaliber-lite-api.onrender.com |
| Database | Neon | configured via `DATABASE_URL` on Render |

- Vercel config: `apps/web/vercel.json` — overrides `installCommand` to run `pnpm install` from the workspace root (required for monorepo)
- Render: manually configured web service; build command runs migrations + seed before starting
- CORS: `CORS_ORIGINS` env var on Render must include the Vercel URL — update it if the Vercel project URL ever changes
