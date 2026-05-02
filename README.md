# Eggscaliber Lite

Data analysis platform — cross-tab analytics, trending, and natural language queries.

## Prerequisites

Install these before running `just setup`:

| Tool | Install |
|---|---|
| [just](https://just.systems) | `brew install just` / `cargo install just` / [binary releases](https://github.com/casey/just/releases) |
| [Docker](https://docs.docker.com/get-docker/) | Docker Desktop or Docker Engine |
| [pnpm](https://pnpm.io/installation) | `npm install -g pnpm` or `corepack enable` |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [Node.js 22+](https://nodejs.org) | via [nvm](https://github.com/nvm-sh/nvm) or direct download |
| [Python 3.12+](https://www.python.org) | via [pyenv](https://github.com/pyenv/pyenv) or direct download |

## Quick start

```bash
cp .env.example .env.local   # fill in any required values
just setup                   # installs deps, starts Docker, runs migrations, generates types
just dev                     # starts api (localhost:8000) + web (localhost:3000)
```

## Common commands

```bash
just dev            # api + web dev servers
just storybook      # Storybook component library (localhost:6006)
just test           # run all tests
just lint           # lint Python + TypeScript
just format         # format Python + TypeScript
just typecheck      # type-check Python + TypeScript
just db-migrate     # run pending migrations
just db-migration "add users table"  # generate a new migration
just generate-types # regenerate TypeScript types from FastAPI OpenAPI spec
```

Run `just` at the repo root to see all available commands.

## Task Management

Issues are tracked in two places that work together:

- **GitHub Issues / Projects** — the source of truth for planned and in-flight work. Use labels and the project board to prioritise.
- **Beads (`bd`)** — a git-native CLI tracker (`.beads/`) that lives next to the code. Agents and developers use it for session-level tracking and to surface what is ready to work.

```bash
bd ready              # issues with no blockers
bd show <id>          # view details
bd update <id> --claim  # take ownership
bd close <id>         # mark complete
```

### Autonomous agent workflow

Issues labelled **`agent-ready`** on GitHub are safe for an AI agent to pick up end-to-end:

1. Mirror the issue into Beads and break into sub-tasks if non-trivial.
2. Create a branch: `agent/<issue-number>-<short-slug>` off `master`.
3. Implement in focused commits.
4. Run `just lint && just format-check && just typecheck && just test` — nothing ships with a failing check.
5. Open a PR referencing the issue (`Closes #<n>`).
6. Stop — a human reviews and merges.

## Deployment

Pushes to `master` deploy automatically:

| Service | Platform | URL |
|---|---|---|
| Web (Next.js) | Vercel | [eggscaliber-lite-web.vercel.app](https://eggscaliber-lite-web.vercel.app) |
| API (FastAPI) | Render | [eggscaliber-lite-api.onrender.com](https://eggscaliber-lite-api.onrender.com) |
| Database | Neon (Postgres + pgvector) | — |

Render runs `alembic upgrade head` and the seed script before each deploy.
The seed is idempotent — it skips if demo data already exists.
