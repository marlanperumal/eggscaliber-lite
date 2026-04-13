# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Always run commands via `just <command>` from the repo root.** Do not invoke tools directly (e.g. use `just test-api` not `cd apps/api && uv run pytest`). The justfile loads `.env.local` automatically via `set dotenv-load`.

Check `just --list` for all available commands. Only fall back to direct invocation when no `just` recipe covers the operation.

**Everything runs from the repo root — never `cd` into a subdirectory to run a command.** The monorepo is set up so all tooling can be targeted from root:

- **`just` commands** handle subdirectory navigation internally — always prefer these.
- **pnpm workspace commands** — use `--filter` to target a workspace from root:
  ```bash
  pnpm --filter web run build              # run a script in apps/web
  pnpm --filter web exec tsc --noEmit      # run a binary in apps/web context
  ```
  For adding packages, prefer `just add-web-dep` / `just add-web-dev-dep`.
- **uv one-off commands** — use `--project` to target apps/api from root:
  ```bash
  uv run --project apps/api <command>
  ```
  For adding packages, prefer `just add-api-dep` / `just add-api-dev-dep`.

**Prefer approval-free forms.** `just` commands are pre-approved and should always be used over their raw equivalents — not just for correctness, but because the raw form may require manual approval and block progress. Examples:
- `just test-api` ✅ vs `cd apps/api && uv run pytest` ❌
- `just lint` ✅ vs `cd apps/api && uv run ruff check --fix` ❌
- `just format` ✅ vs `cd apps/api && uv run ruff format` ❌

When hitting local API endpoints (e.g. smoke-testing), use `curl`. Piping to `python3 -m json.tool` for pretty-printing is fine. Never pipe `curl` output to a shell execution command (`| bash`, `| sh`, `| python3 -` etc.) — capture to a variable or file first if processing is needed.

Do not create new `just` recipes purely to work around approval gates — all new recipes must be discussed and approved first. If approval is genuinely needed for an operation, ask.

Never start a Bash tool call with a `#` comment — the allowlist matches against the start of the command string, so a leading comment will block auto-approval. Put explanatory text in the surrounding response instead.

Run `git add` and `git commit` as separate Bash tool calls, not chained with `&&`. Always write the commit message to `/tmp/commit-msg.txt` using the Write tool, then commit with:

```bash
git commit -F /tmp/commit-msg.txt
```

This keeps multi-line messages with `Co-Authored-By` trailers on one clean Bash call that matches the allowlist.

**Never use `git -C`.** Run all `git` commands from the repo root without `-C`. If a git command fails because the working directory is wrong, fix it with `cd` first — do not reach for `-C` as a shortcut.
- `git add apps/api/src/foo.py` ✅ vs `git -C apps/api add src/foo.py` ❌

Keep Bash tool calls simple — avoid complex quoting or chaining that may not match allowlist patterns. If a command needs multiple steps, use separate Bash tool calls.

Use dedicated tools instead of Bash wherever possible — they work anywhere on the filesystem without needing allowlist approval:
- File search: `Glob` (not `find` or `ls`)
- Content search: `Grep` (not `grep` or `rg`)
- Read files: `Read` (not `cat`/`head`/`tail`/`sed`)
- Edit files: `Edit` (not `sed`/`awk`)
- Write files: `Write` (not `echo >`/`cat <<EOF`)

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
- `apps/web/src/config/theme.config.ts` — Design system config. Contains named theme presets (`themes.orange`, `themes.steel`); change the `themeConfig` export to switch palette. See `docs/patterns/design-system.md`.
- `packages/shared/api.d.ts` — **AUTO-GENERATED** TypeScript types from FastAPI OpenAPI spec. Never edit manually. Run `just generate-types`.
- `docker/init/` — SQL bootstrap only (create DBs + extensions). All schema lives in `apps/api/migrations/`.

## Key Conventions

- All API routes prefixed `/api/v1/`
- Commit messages follow Conventional Commits: `feat(scope):`, `fix(scope):`, `chore(scope):` etc. Valid scopes: `api`, `web`, `shared`, `docker`, `ci`, `deps`, `docs`, `notebooks`
- Stories colocated with components: `Button.tsx` + `Button.stories.tsx` in the same directory
- Never add SQLite-based tests — all tests run against the real Postgres test DB
- Never mock the database or internal services — see `docs/testing.md`
- Architecture rules are in `docs/patterns.md` — run `audit-patterns` skill periodically
- Frontend styling uses a token-based design system — see `docs/patterns/design-system.md`. Never use raw hex values or `text-primary` as a text colour. Never write `dark:` overrides — tokens handle both modes. Every new component needs a Storybook story with a11y passing.

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

## Visual Companion (Brainstorming)

When generating mockups for the visual companion, always make the images large and legible:
- Use tall card images (min 300px height, prefer more)
- Use readable font sizes (min 11px for body text, 13px+ for labels)
- Show multiple states per option (e.g. default, collapsed, both-collapsed) as separate rows within the same card
- Use inline `<style>` blocks with named classes rather than repeating inline styles — keeps the HTML cleaner and the mockups more consistent
- Use real content from the project's seed data (field names, level names) rather than placeholder text

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
