# CLAUDE.md

## CRITICAL RULES

These are enforced by hooks but check them yourself first:

1. **Always use `just <cmd>` from repo root** — never `cd` into a subdirectory; never invoke raw `uv run`, `pytest`, `pnpm` etc. directly when a `just` recipe exists. Run `just --list` to check.
2. **Never start a Bash call with a `#` comment** — blocks auto-approval.
3. **`git add` and `git commit` must be separate Bash calls** — write message to `/tmp/commit-msg.txt` with the Write tool, then `git commit -F /tmp/commit-msg.txt`.
4. **Never edit `packages/shared/api.d.ts` manually** — it is AUTO-GENERATED. Run `just generate-types`.
5. **Subagents must `Read CLAUDE.md` as their very first step** — include this instruction explicitly in every subagent prompt.
6. **Never use raw colour literals in component code.** No hex (`#fff`, `#0ea5e9`), no `rgb()`/`rgba()`, no `hsl()`/`hsla()`, no `oklch()` literals in `.tsx`/`.jsx`/`.css` files. The only sanctioned raw values in component code are `transparent` and `currentColor`. Hex is permitted *only* in the token definition site (`apps/web/src/lib/theme.ts`). Never use `text-primary` as a text colour (it's a surface token — chips/icons/focus rings only). Never write `dark:` overrides — tokens handle both modes.
7. **Never use `git -C`** — fix the cwd with `cd` first. `git -C` bypasses allowlist approvals.
8. **Never use bare `python3` or `pip`** — always use `uv run python3` / `uv pip`.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Discipline

**Verification before completion.** Never claim work is "done", "fixed", "passing", or "ready" without running the actual check and observing its output. When reporting completion, paste the exact command you ran and a relevant snippet of its real output — not a summary, not a paraphrase. If a subagent reports a result (e.g. "0 tests found", "all green"), grep-verify the claim before trusting it.

**Research before custom implementations.** For framework-specific work (shadcn/ui, next-themes, Clerk, nuqs, Next.js App Router, FastAPI, Pydantic), first consult the official docs via `WebFetch` or `context7` and quote the recommended pattern. Deviate only with explicit approval. Past detours: custom next-themes implementation when the shadcn-recommended fix existed; sweeping `sed` substitutions across multiple files without dry-run.

**Step-gate audits and destructive ops.** When asked for step-by-step verification, run one step, paste its output, wait for confirmation. Do not batch. Before any operation that touches many files at once (multi-file `sed`, shadcn re-install, mass refactor), preview the scope first.

**Persistence is part of "done".** When you swap a tool, change a convention, or settle on a new pattern mid-session, update CLAUDE.md (or auto-memory) as part of the same task — not as a follow-up the user has to prompt for.

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
just build-storybook # build Storybook static output (verify no component errors)
```

## Architecture

- `apps/api/` — FastAPI backend. Strict 3-layer: `routes/` → `services/` → `repositories/`. See `docs/patterns/backend.md`.
- `apps/web/` — Next.js frontend (App Router). See `docs/patterns/frontend.md`.
- `apps/web/src/config/theme.config.ts` — Design system config. Contains named theme presets (`themes.orange`, `themes.steel`); change the `themeConfig` export to switch palette. See `docs/patterns/design-system.md`.
- `packages/shared/api.d.ts` — **AUTO-GENERATED** TypeScript types from FastAPI OpenAPI spec. Never edit manually. Run `just generate-types`.
- `docker/init/` — SQL bootstrap only (create DBs + extensions). All schema lives in `apps/api/migrations/`.

## Browser Automation

Use **`agent-browser`** (CLI) for all interactive browser work — UI testing, visual verification, scraping. Never reach for Playwright MCP; it has been removed. The Playwright test runner (`playwright.config.ts`) remains for the E2E test suite and is separate.

```bash
agent-browser open <url>       # navigate
agent-browser snapshot -i      # accessibility tree (compact, AI-friendly)
agent-browser click @e2        # click by ref from snapshot
agent-browser fill @e3 <text>  # type into field
agent-browser screenshot       # capture
```

## MCP Servers

Two MCP servers are available in Claude Code sessions for local dev:

**`eggscaliber`** — API-level tools (streamable HTTP, requires `just dev` or `just api`). Exposed tags: `packages`, `scope`, `collections`, `datasets`, `analytics`. Use for high-level data queries and analytics. See `docs/patterns/backend.md` for wiring details and the docstring requirement for MCP-exposed routes.

**`postgres`** — Direct read-only DB access (stdio, requires `just db-up`). Use for schema inspection, raw SQL, EXPLAIN plans, and index analysis. Spawned automatically by Claude Code via `uvx postgres-mcp` — no extra server needed.

## Pre-push Checklist

Before pushing to master, run all of the following and confirm they pass:

```bash
just lint && just format-check && just typecheck && just build-storybook && just test
```

These mirror the CI pipeline. Every check must be green before pushing.

**Enforced by hook.** `.claude/hooks/pre-push-check.sh` runs `just lint`, `just format-check`, `just typecheck`, and `just test` automatically before any `git push` and blocks on failure. To bypass for a deliberate WIP push, prefix the command: `SKIP_PRE_PUSH=1 git push ...`. The hook does not run `just build-storybook` — run that manually if you've touched Storybook-relevant code.

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

## Agent workflow (for autonomous Claude Code runs)

When an issue is labeled `agent-ready`:

1. Branch: `agent/<issue-number>-<short-slug>` off `master`.
2. Implement focused commits using the preset git identity.
3. Run the project's test suite. Don't claim done if anything fails.
4. Open a PR referencing the issue (`Closes #<n>`).
5. Stop. Human reviews and merges.

### Agent runtime environment

The agent container has all dev deps (just, Node, pnpm, uv, Python). The dev databases
(Postgres etc.) are already running on the host and reachable via `localhost`. Do **not**
run `just db-up` — it's already up. If a connection fails, ask for help; do not try to
restart Docker services.

### Conventions
- Don't modify CI config or secrets unless explicitly asked.
- Read existing code before introducing new abstractions; match the repo's style.
- If a task is out of scope or unclear, comment on the issue and stop — don't guess.

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


## Task Tracking

Use Claude Code's built-in task tools for in-session work. For anything that needs to outlive a session, file a GitHub issue. Don't use markdown TODO files.

## Session Completion

Work is not complete until `git push` succeeds. Before ending a session:

1. Run quality gates (`just lint && just typecheck && just test`) if code changed
2. Commit outstanding work
3. `git pull --rebase` then `git push`
4. Verify `git status` shows "up to date with origin"

If push fails, resolve and retry — never leave work stranded locally.
