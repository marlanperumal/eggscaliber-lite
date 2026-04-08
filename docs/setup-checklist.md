# Setup Checklist — External Services & MCPs

Two manual tasks remaining before the platform is fully operational.
Full instructions are in `docs/superpowers/plans/`.

---

## Task 11: External Services

Sign up and gather credentials into `.env.local`.

### Accounts to create

| Service | URL | What to copy |
|---|---|---|
| **Neon** | https://neon.tech | Connection string → `DATABASE_URL` (prod). Create a `staging` branch too. |
| **Clerk** | https://clerk.com | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` |
| **Cloudflare R2** | https://dash.cloudflare.com → R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Bucket name: `eggscaliber-lite` |
| **Sentry** | https://sentry.io | Two projects: `eggscaliber-api` (FastAPI) → `SENTRY_DSN`; `eggscaliber-web` (Next.js) → `NEXT_PUBLIC_SENTRY_DSN`. Get `SENTRY_AUTH_TOKEN` from User Settings → Auth Tokens (needed for sourcemap uploads). |
| **PostHog** | https://app.posthog.com (US) or https://eu.posthog.com (EU) | `NEXT_PUBLIC_POSTHOG_KEY`. Set `NEXT_PUBLIC_POSTHOG_HOST` to match your region: `https://us.i.posthog.com` or `https://eu.i.posthog.com`. |
| **Chromatic** | https://www.chromatic.com | `CHROMATIC_PROJECT_TOKEN` → add as GitHub Actions secret |

### Deployment connections

| Platform | Steps |
|---|---|
| **Vercel** | New Project → import GitHub repo → Root Directory: `apps/web` → add all `NEXT_PUBLIC_*` + `CLERK_SECRET_KEY` + `SENTRY_AUTH_TOKEN` env vars |
| **Render** | New Web Service → Root Directory: `apps/api` → Build: `uv sync` → Start: `uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT` → add `DATABASE_URL` (Neon prod), `SENTRY_DSN`, `ENVIRONMENT=production`, `AUTH_MODE=clerk`, `CLERK_SECRET_KEY` |

### Final `.env.local` shape

```bash
# Local dev DB (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_dev
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_test
MIGRATIONS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eggscaliber_migrations_test

# Auth
AUTH_MODE=dev
DEV_JWT_SECRET=dev-secret-change-in-production

# Storage (local MinIO)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Sentry (optional in dev, required for sourcemap uploads)
SENTRY_DSN=https://...@de.sentry.io/...
NEXT_PUBLIC_SENTRY_DSN=https://...@de.sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...

# PostHog — match host to your account region (us or eu)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

ENVIRONMENT=development
```

Verify with `just setup` then `just dev`.

---

## Task 12: MCP Configuration

Add to `~/.claude/settings.json` under `"mcpServers"`. These are user-level — not git-tracked.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<token>" }
    },
    "linear": {
      "command": "npx",
      "args": ["-y", "@linear/mcp-server"],
      "env": { "LINEAR_API_KEY": "<key>" }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    },
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": { "NEON_API_KEY": "<key>" }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

### Where to get each key

| MCP | Key location |
|---|---|
| GitHub | https://github.com/settings/tokens → scopes: `repo`, `read:org`, `workflow` |
| Linear | Linear → Settings → API → Personal API Keys |
| Neon | Neon dashboard → Account → API Keys |
| Context7 | No key needed |
| Playwright | No key needed |
