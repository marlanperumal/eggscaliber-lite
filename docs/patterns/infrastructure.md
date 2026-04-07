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
