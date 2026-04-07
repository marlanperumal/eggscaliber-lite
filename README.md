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
