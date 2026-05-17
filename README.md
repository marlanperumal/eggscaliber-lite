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

### Beads (bd)

[Beads](https://beads.sh) is a versioned issue-tracking CLI used during autonomous agent runs. It mirrors GitHub Issues>

```bash
bd prime                      # Print full workflow context and command reference
bd ready                      # List agent-ready issues available for work
bd show <id>                  # View issue details and sub-tasks
bd add                        # Mirror a GitHub issue into beads
bd update <id> --claim        # Claim an issue before starting work
bd close <id>                 # Mark work complete
bd dolt push                  # Sync beads state to remote
```

### Autonomous agent workflow

When an issue is labelled `agent-ready`:

1. The agent mirrors it into beads (`bd add`) and breaks it into sub-tasks if non-trivial.
2. A branch is created: `agent/<issue-number>-<short-slug>` off `master`.
3. The agent implements focused commits, following the conventions in `CLAUDE.md`.
4. Tests must pass — the agent does not claim completion if anything fails.
5. A PR is opened referencing the issue (`Closes #<n>`).
6. A human reviews and merges. The agent stops.

See `CLAUDE.md` → *Agent workflow* for the full protocol and conventions.

## Deployment

Pushes to `master` deploy automatically:

| Service | Platform | URL |
|---|---|---|
| Web (Next.js) | Vercel | [eggscaliber-lite-web.vercel.app](https://eggscaliber-lite-web.vercel.app) |
| API (FastAPI) | Render | [eggscaliber-lite-api.onrender.com](https://eggscaliber-lite-api.onrender.com) |
| Database | Neon (Postgres + pgvector) | — |

Render runs `alembic upgrade head` and the seed script before each deploy.
The seed is idempotent — it skips if demo data already exists.
