# create-eggscaliber-app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `create-eggscaliber-app` — a Copier-based project template that scaffolds a
new full-stack project from `eggscaliber-lite` in minutes, with interactive integration
selection and a post-copy hook that generates `SETUP.md` and prints a terminal summary.

**Architecture:** New GitHub repo `create-eggscaliber-app` containing `template/` (copy of
`eggscaliber-lite` with Jinja2 conditionals), `copier.yaml` (interactive questions), and
`hooks/post_copy.py` (SETUP.md + terminal summary). `_templates_suffix: ""` means all files
are Jinja2 templates; GitHub Actions `${{ }}` expressions are escaped with `{% raw %}`.

**Tech Stack:** Copier ≥9.0, Python 3.12+, uv, pytest, Jinja2 (via Copier)

---

## Context for the Implementer

This plan builds a **new repository** (`create-eggscaliber-app`) that is separate from the
`eggscaliber-lite` repo where this plan is stored. Start by creating the new directory.

The source material is `eggscaliber-lite` — clone or copy it as the starting point for
`template/`. All paths below are relative to the new `create-eggscaliber-app/` root unless
otherwise stated.

**Key constraint:** Because `_templates_suffix: ""` makes Copier treat every file as Jinja2,
GitHub Actions `${{ secrets.X }}` expressions must be wrapped with `{% raw %}..{% endraw %}`
to prevent Jinja2 from interpreting them.

**Checking the latest Copier version:** Before writing `pyproject.toml`, run:

```bash
uv pip index versions copier 2>/dev/null | head -1
```

Use the latest stable version (not the version in this plan, which may be outdated).

---

## File Map

```
create-eggscaliber-app/
├── copier.yaml                     # questions, exclusion rules, _templates_suffix: ""
├── pyproject.toml                  # dev deps: copier, pytest, pyyaml
├── justfile                        # just test, just dev (local scaffold)
├── .gitignore
├── README.md                       # template repo README
├── hooks/
│   ├── __init__.py
│   └── post_copy.py                # generates SETUP.md + prints terminal summary
├── tests/
│   ├── __init__.py
│   └── test_post_copy.py           # unit tests for post_copy.py functions
└── template/                       # near-copy of eggscaliber-lite
    ├── apps/
    │   ├── api/
    │   │   ├── src/
    │   │   │   ├── main.py         # Jinja2: sentry conditional
    │   │   │   ├── config.py       # Jinja2: project_name in DB defaults
    │   │   │   ├── database.py
    │   │   │   └── routes/
    │   │   │       ├── health.py
    │   │   │       └── sentry.py   # excluded if not use_sentry
    │   │   ├── migrations/
    │   │   ├── tests/
    │   │   ├── alembic.ini
    │   │   └── pyproject.toml      # Jinja2: sentry-sdk, marimo conditionals
    │   └── web/
    │       ├── src/
    │       │   ├── app/
    │       │   │   ├── layout.tsx  # Jinja2: posthog, clerk conditionals
    │       │   │   └── ...
    │       │   ├── instrumentation.ts      # excluded if not use_sentry
    │       │   ├── instrumentation-client.ts  # excluded if not use_sentry
    │       │   ├── proxy.ts        # excluded if not use_posthog
    │       │   └── middleware.ts   # excluded if not use_clerk
    │       ├── sentry.client.config.ts     # excluded if not use_sentry
    │       ├── sentry.server.config.ts     # excluded if not use_sentry
    │       ├── sentry.edge.config.ts       # excluded if not use_sentry
    │       ├── next.config.ts      # Jinja2: sentry/plain config
    │       ├── package.json        # Jinja2: clerk, posthog, sentry conditionals
    │       └── ...
    ├── docker-compose.yml          # Jinja2: project_name in service names
    ├── justfile                    # Jinja2: marimo conditional
    ├── pyproject.toml              # (root) Jinja2: project_name
    ├── package.json                # Jinja2: project_name
    ├── .env.example                # Jinja2: integration env var conditionals
    ├── vercel.json                 # excluded if not use_vercel
    ├── render.yaml                 # excluded if not use_render
    ├── .github/
    │   └── workflows/
    │       ├── pr.yml              # Jinja2: project_name, chromatic conditional
    │       └── deploy.yml          # Jinja2: chromatic/vercel/render conditionals
    ├── CLAUDE.md                   # Jinja2: project_name
    └── README.md                   # Jinja2: project_name, description
```

---

## Task 1: Bootstrap the Repository

**Files:**

- Create: `pyproject.toml`
- Create: `justfile`
- Create: `.gitignore`

- [ ] **Step 1: Create the repo directory and initialise git**

```bash
mkdir create-eggscaliber-app
cd create-eggscaliber-app
git init
```

- [ ] **Step 2: Check the latest stable Copier version**

```bash
uv pip index versions copier 2>/dev/null | head -3
```

Note the latest stable version (e.g. `9.4.1`) — use it in Step 3.

- [ ] **Step 3: Write `pyproject.toml`**

```toml
[project]
name = "create-eggscaliber-app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []

[dependency-groups]
dev = [
    "copier>=9.4.0",   # replace with latest stable from Step 2
    "pytest>=8.0.0",
    "pyyaml>=6.0.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

- [ ] **Step 4: Write `justfile`**

```just
# Default: list commands
default:
    @just --list

# Scaffold a test project with all integrations (non-interactive)
test:
    rm -rf /tmp/cea-test-output
    uvx copier copy . /tmp/cea-test-output \
        --data project_name=test-app \
        --data project_description="Test application" \
        --data use_clerk=true \
        --data use_sentry=true \
        --data use_posthog=true \
        --data use_chromatic=true \
        --data use_marimo=true \
        --data use_vercel=true \
        --data use_render=true \
        --data use_neon=true \
        --defaults --overwrite
    @echo "✔ Template scaffolded to /tmp/cea-test-output"

# Scaffold interactively to ./test-output for manual inspection
dev:
    rm -rf ./test-output
    uvx copier copy . ./test-output

# Run pytest unit tests
unit:
    uv run pytest tests/ -v
```

- [ ] **Step 5: Write `.gitignore`**

```
__pycache__/
*.pyc
.venv/
test-output/
dist/
*.egg-info/
```

- [ ] **Step 6: Install dev dependencies**

```bash
uv sync
```

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml justfile .gitignore
git commit -m "chore: bootstrap create-eggscaliber-app repo"
```

---

## Task 2: Copy the Template from eggscaliber-lite

**Files:**

- Create: `template/` (from eggscaliber-lite source)

- [ ] **Step 1: Copy eggscaliber-lite into `template/`**

From inside `create-eggscaliber-app/`:

```bash
# Adjust the path to wherever eggscaliber-lite lives
rsync -av \
  --exclude='.git' \
  --exclude='.env.local' \
  --exclude='node_modules' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.next' \
  --exclude='storybook-static' \
  --exclude='build-storybook.log' \
  --exclude='dist' \
  --exclude='*.egg-info' \
  --exclude='uv.lock' \
  --exclude='pnpm-lock.yaml' \
  ../eggscaliber-lite/ \
  template/
```

- [ ] **Step 2: Verify the copy**

```bash
ls template/
ls template/apps/api/src/
ls template/apps/web/src/
```

Expected: standard project layout without `.git`, `node_modules`, `.venv`, `.env.local`.

- [ ] **Step 3: Create `hooks/__init__.py` and `tests/__init__.py`**

```bash
mkdir -p hooks tests
touch hooks/__init__.py tests/__init__.py
```

- [ ] **Step 4: Commit**

```bash
git add template/ hooks/ tests/
git commit -m "chore: add eggscaliber-lite as template source"
```

---

## Task 3: Write `copier.yaml`

**Files:**

- Create: `copier.yaml`

- [ ] **Step 1: Write `copier.yaml`**

```yaml
# copier.yaml
_templates_suffix: ""
_subdirectory: template

# Jinja2 in {% raw %} to avoid Copier processing the escape sequence itself.
# In template files, wrap GitHub Actions ${{ }} with {% raw %}...{% endraw %}.

# ── Project identity ─────────────────────────────────────────────────────────

project_name:
  type: str
  help: "Project name (lowercase, hyphens OK — used in package names and DB names)"
  placeholder: my-app
  validator: "{% if not (project_name | regex_search('^[a-z][a-z0-9-]*$')) %}Must be lowercase letters, numbers, and hyphens only{% endif %}"

project_description:
  type: str
  help: "One-line description of your project"
  placeholder: A full-stack web application

# ── Development integrations ─────────────────────────────────────────────────

use_clerk:
  type: bool
  help: "Include Clerk for authentication?"
  default: true

use_sentry:
  type: bool
  help: "Include Sentry for error monitoring? (covers both API and web)"
  default: true

use_posthog:
  type: bool
  help: "Include PostHog for analytics?"
  default: true

use_chromatic:
  type: bool
  help: "Include Chromatic for Storybook visual regression testing?"
  default: false

use_marimo:
  type: bool
  help: "Include Marimo notebooks?"
  default: false

# ── Deployment integrations ──────────────────────────────────────────────────

use_vercel:
  type: bool
  help: "Include Vercel config for web deployment? (uses Vercel GitHub integration)"
  default: false

use_render:
  type: bool
  help: "Include Render config for API deployment? (uses Render GitHub integration)"
  default: false

use_neon:
  type: bool
  help: "Include Neon managed Postgres for production?"
  default: false
  when: "{{ use_render }}"

# ── File exclusions ──────────────────────────────────────────────────────────

_exclude:
  # Sentry — web config files (instrumentation files handled inline)
  - "{% if not use_sentry %}apps/web/sentry.client.config.ts{% endif %}"
  - "{% if not use_sentry %}apps/web/sentry.server.config.ts{% endif %}"
  - "{% if not use_sentry %}apps/web/sentry.edge.config.ts{% endif %}"
  - "{% if not use_sentry %}apps/web/src/instrumentation.ts{% endif %}"
  - "{% if not use_sentry %}apps/web/src/instrumentation-client.ts{% endif %}"
  - "{% if not use_sentry %}apps/web/src/app/sentry-example-page{% endif %}"
  - "{% if not use_sentry %}apps/api/src/routes/sentry.py{% endif %}"
  # PostHog — proxy middleware
  - "{% if not use_posthog %}apps/web/src/proxy.ts{% endif %}"
  # Clerk — Next.js middleware
  - "{% if not use_clerk %}apps/web/src/middleware.ts{% endif %}"
  # Marimo — notebooks directory
  - "{% if not use_marimo %}notebooks{% endif %}"
  # Deployment — platform config files
  - "{% if not use_vercel %}vercel.json{% endif %}"
  - "{% if not use_render %}render.yaml{% endif %}"
  # deploy.yml excluded if no deployment integration selected
  - "{% if not use_vercel and not use_render and not use_chromatic %}.github/workflows/deploy.yml{% endif %}"
```

- [ ] **Step 2: Verify copier.yaml parses correctly**

```bash
uvx copier copy . /tmp/cea-syntax-check \
  --data project_name=test-app \
  --data project_description="Test" \
  --defaults --overwrite 2>&1 | head -20
```

Expected: output without YAML parse errors (may show Jinja2 errors on un-modified files — that's fine for now, fix in later tasks).

- [ ] **Step 3: Commit**

```bash
git add copier.yaml
git commit -m "feat: add copier.yaml with questions and file exclusion rules"
```

---

## Task 4: Project Name Substitution

Replace all hard-coded `eggscaliber` / `eggscaliber-lite` / `eggscaliber_dev` /
`eggscaliber_test` occurrences with Jinja2 `{{ project_name }}` throughout the template.

**Files to modify:**

- `template/apps/api/src/config.py`
- `template/apps/api/src/main.py`
- `template/apps/api/pyproject.toml`
- `template/apps/web/next.config.ts`
- `template/apps/web/package.json`
- `template/package.json`
- `template/docker-compose.yml`
- `template/.github/workflows/pr.yml`
- `template/.github/workflows/deploy.yml`
- `template/CLAUDE.md`
- `template/README.md`

- [ ] **Step 1: Update `template/apps/api/src/config.py`**

Replace the three DB URL defaults:

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_dev"
    test_database_url: str = "postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_test"
    migrations_test_database_url: str = (
        "postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_migrations_test"
    )
```

- [ ] **Step 2: Update `template/apps/api/src/main.py` title**

```python
app = FastAPI(title="{{ project_name }} API", version="0.1.0")
```

- [ ] **Step 3: Update `template/apps/api/pyproject.toml` name**

```toml
[project]
name = "api"
version = "0.1.0"
```

(The API pyproject name stays `api` — it's the internal package name, not the project.)

- [ ] **Step 4: Update `template/package.json` name**

```json
{
  "name": "{{ project_name }}"
}
```

- [ ] **Step 5: Update `template/.env.example` DB URLs**

Replace the three database URL lines:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_dev
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_test
MIGRATIONS_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_migrations_test
```

- [ ] **Step 6: Update `template/.github/workflows/pr.yml`**

Replace the three `env:` DATABASE_URL values and the six `CREATE DATABASE` / `CREATE EXTENSION` commands. Also wrap all `${{ }}` expressions with `{% raw %}`:

```yaml
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_dev
      TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_test
      MIGRATIONS_TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/{{ project_name | replace('-', '_') }}_migrations_test
```

```yaml
      - name: Create test databases and extensions
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE {{ project_name | replace('-', '_') }}_dev;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE {{ project_name | replace('-', '_') }}_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE {{ project_name | replace('-', '_') }}_migrations_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d {{ project_name | replace('-', '_') }}_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d {{ project_name | replace('-', '_') }}_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
          PGPASSWORD=postgres psql -h localhost -U postgres -d {{ project_name | replace('-', '_') }}_migrations_test -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Wrap the Alembic migration `env:` block:

```yaml
      - name: Run migrations (test DB)
        run: cd apps/api && uv run alembic upgrade head
        env:
          DATABASE_URL: {% raw %}${{ env.TEST_DATABASE_URL }}{% endraw %}
```

- [ ] **Step 7: Update `template/.github/workflows/deploy.yml`**

Replace the three DATABASE_URL env values and six `CREATE DATABASE` commands (same pattern as Step 6). Wrap the Alembic step:

```yaml
        env:
          DATABASE_URL: {% raw %}${{ env.TEST_DATABASE_URL }}{% endraw %}
```

Wrap the Chromatic token:

```yaml
      - name: Deploy to Chromatic
        run: cd apps/web && pnpm chromatic --project-token={% raw %}${{ secrets.CHROMATIC_PROJECT_TOKEN }}{% endraw %}
```

- [ ] **Step 8: Update `template/apps/web/next.config.ts` Sentry org/project**

```typescript
export default withSentryConfig(nextConfig, {
  org: "{{ project_name }}",
  project: "{{ project_name }}-web",
  // ... rest unchanged
})
```

- [ ] **Step 9: Update `template/apps/web/src/app/layout.tsx` title**

```typescript
export const metadata: Metadata = {
  title: "{{ project_name }}",
  description: "{{ project_description }}",
}
```

- [ ] **Step 10: Update `template/CLAUDE.md`**

Replace all occurrences of `eggscaliber-lite` with `{{ project_name }}` and `eggscaliber`
with `{{ project_name }}`.

- [ ] **Step 11: Test the substitution by scaffolding**

```bash
uvx copier copy . /tmp/cea-name-test \
  --data project_name=my-new-app \
  --data project_description="My new app" \
  --defaults --overwrite

grep -r "eggscaliber" /tmp/cea-name-test/ --include="*.py" --include="*.ts" --include="*.yml" --include="*.toml" --include="*.json" | grep -v ".copier-answers"
```

Expected: no matches (all `eggscaliber` replaced).

- [ ] **Step 12: Commit**

```bash
git add template/
git commit -m "feat: add project_name substitution throughout template"
```

---

## Task 5: Sentry Integration Conditionals

Make Sentry optional in both API and web layers.

**Files to modify:**

- `template/apps/api/src/main.py`
- `template/apps/api/pyproject.toml`
- `template/apps/web/next.config.ts`
- `template/apps/web/package.json`
- `template/.env.example`

(The sentry config files, instrumentation files, sentry route, and sentry-example-page are
handled via `_exclude` in `copier.yaml` — already done in Task 3.)

- [ ] **Step 1: Wrap Sentry in `template/apps/api/src/main.py`**

```python
{% if use_sentry %}
import sentry_sdk
{% endif %}
from fastapi import FastAPI

from src.config import settings
{% if use_sentry %}
from src.routes import health, sentry
{% else %}
from src.routes import health
{% endif %}

{% if use_sentry %}
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=0.1,
    )
{% endif %}

app = FastAPI(title="{{ project_name }} API", version="0.1.0")

app.include_router(health.router, prefix="/api/v1")
{% if use_sentry %}
app.include_router(sentry.router, prefix="/api/v1")
{% endif %}
```

- [ ] **Step 2: Wrap Sentry dep in `template/apps/api/pyproject.toml`**

```toml
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlmodel>=0.0.21",
    "alembic>=1.13.0",
    "pydantic-settings>=2.0.0",
    "psycopg2-binary>=2.9.0",
{% if use_sentry %}
    "sentry-sdk[fastapi]>=2.0.0",
{% endif %}
{% if use_marimo %}
    "marimo>=0.0.1",
{% endif %}
]
```

(Marimo included here since it's also in `pyproject.toml` — handle both in this file now.)

- [ ] **Step 3: Wrap Sentry in `template/apps/web/next.config.ts`**

```typescript
{% if use_sentry %}
import { withSentryConfig } from "@sentry/nextjs"
{% endif %}
import type { NextConfig } from "next"

const nextConfig: NextConfig = {}

{% if use_sentry %}
export default withSentryConfig(nextConfig, {
  org: "{{ project_name }}",
  project: "{{ project_name }}-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
{% else %}
export default nextConfig
{% endif %}
```

- [ ] **Step 4: Wrap `@sentry/nextjs` in `template/apps/web/package.json`**

```json
{
  "dependencies": {
    {% if use_clerk %}"@clerk/nextjs": "^7.0.11",{% endif %}
    {% if use_posthog %}"@posthog/next": "^0.1.0",{% endif %}
    {% if use_posthog %}"@posthog/nextjs-config": "^1.9.1",{% endif %}
    {% if use_sentry %}"@sentry/nextjs": "^10.47.0",{% endif %}
    "clsx": "^2.1.1",
    "next": "^16.2.2",
    "openapi-fetch": "^0.17.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "recharts": "^3.8.1",
    "tailwind-merge": "^3.5.0"
  }
}
```

(Clerk and PostHog deps included here — handle all three in this file now.)

- [ ] **Step 5: Wrap Sentry env vars in `template/.env.example`**

```bash
{% if use_sentry %}
# Sentry (optional in dev, required for sourcemap uploads in CI/prod)
# SENTRY_DSN=https://...@de.sentry.io/...          ← FastAPI project DSN
# NEXT_PUBLIC_SENTRY_DSN=https://...@de.sentry.io/...  ← Next.js project DSN
# SENTRY_AUTH_TOKEN=sntrys_...                      ← for sourcemap uploads (Vercel + CI)
{% endif %}
```

- [ ] **Step 6: Scaffold without Sentry and verify**

```bash
uvx copier copy . /tmp/cea-no-sentry \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_sentry=false \
  --defaults --overwrite

# Should not exist
ls /tmp/cea-no-sentry/apps/web/sentry.client.config.ts 2>/dev/null && echo "FAIL: file should be excluded" || echo "PASS: sentry files excluded"

# Should not contain sentry imports
grep -r "sentry" /tmp/cea-no-sentry/apps/api/src/main.py && echo "FAIL" || echo "PASS: no sentry in main.py"
grep "@sentry/nextjs" /tmp/cea-no-sentry/apps/web/package.json && echo "FAIL" || echo "PASS: no sentry in package.json"
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add template/ copier.yaml
git commit -m "feat: make Sentry integration optional"
```

---

## Task 6: Clerk Integration Conditionals

Make Clerk optional in the web layer. Clerk is currently declared in `package.json` and
`.env.example` but has no `middleware.ts` — the template needs to add one.

**Files to modify:**

- `template/apps/web/src/middleware.ts` (create)
- `template/apps/web/src/app/layout.tsx`
- `template/.env.example`

(`template/apps/web/package.json` already handled in Task 5.)

- [ ] **Step 1: Create `template/apps/web/src/middleware.ts`**

Before creating, fetch the current Clerk Next.js docs to confirm the middleware pattern:

Read: `https://clerk.com/docs/references/nextjs/clerk-middleware`

Then create `template/apps/web/src/middleware.ts`:

```typescript
import { clerkMiddleware } from "@clerk/nextjs/server"

export default clerkMiddleware()

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
```

(This file is only copied when `use_clerk=true` via `_exclude` in `copier.yaml`.)

- [ ] **Step 2: Wrap ClerkProvider in `template/apps/web/src/app/layout.tsx`**

```typescript
{% if use_posthog %}
import { PostHogPageView, PostHogProvider } from "@posthog/next"
{% endif %}
{% if use_clerk %}
import { ClerkProvider } from "@clerk/nextjs"
{% endif %}
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "{{ project_name }}",
  description: "{{ project_description }}",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
{% if use_clerk %}
    <ClerkProvider>
{% endif %}
    <html lang="en">
      <body className={inter.className}>
{% if use_posthog %}
        <PostHogProvider
          clientOptions={{ api_host: "/ingest", debug: process.env.NODE_ENV === "development" }}
          bootstrapFlags
        >
          <PostHogPageView />
          {children}
        </PostHogProvider>
{% else %}
        {children}
{% endif %}
      </body>
    </html>
{% if use_clerk %}
    </ClerkProvider>
{% endif %}
  )
}
```

- [ ] **Step 3: Wrap Clerk env vars in `template/.env.example`**

```bash
{% if use_clerk %}
# Auth — Clerk
# CLERK_SECRET_KEY=sk_...
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
{% else %}
# Auth — set AUTH_MODE=dev for local dev JWT bypass
AUTH_MODE=dev
DEV_JWT_SECRET=dev-secret-change-in-production
{% endif %}
```

- [ ] **Step 4: Scaffold without Clerk and verify**

```bash
uvx copier copy . /tmp/cea-no-clerk \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_clerk=false \
  --defaults --overwrite

ls /tmp/cea-no-clerk/apps/web/src/middleware.ts 2>/dev/null && echo "FAIL: file should be excluded" || echo "PASS"
grep "ClerkProvider" /tmp/cea-no-clerk/apps/web/src/app/layout.tsx && echo "FAIL" || echo "PASS: no ClerkProvider"
grep "@clerk/nextjs" /tmp/cea-no-clerk/apps/web/package.json && echo "FAIL" || echo "PASS: no clerk dep"
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add template/
git commit -m "feat: make Clerk integration optional"
```

---

## Task 7: PostHog Integration Conditionals

PostHog is already partially handled in `layout.tsx` (Task 6) and `package.json` (Task 5).
This task handles the remaining PostHog-specific files and `.env.example`.

**Files to modify:**

- `template/apps/web/src/proxy.ts` (already excluded via `_exclude` when `use_posthog=false`)
- `template/.env.example`

- [ ] **Step 1: Wrap PostHog env vars in `template/.env.example`**

```bash
{% if use_posthog %}
# PostHog — use us.i.posthog.com (US) or eu.i.posthog.com (EU) to match your account region
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
{% endif %}
```

- [ ] **Step 2: Scaffold without PostHog and verify**

```bash
uvx copier copy . /tmp/cea-no-posthog \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_posthog=false \
  --defaults --overwrite

ls /tmp/cea-no-posthog/apps/web/src/proxy.ts 2>/dev/null && echo "FAIL" || echo "PASS: proxy.ts excluded"
grep "PostHogProvider" /tmp/cea-no-posthog/apps/web/src/app/layout.tsx && echo "FAIL" || echo "PASS: no PostHogProvider"
grep "@posthog/next" /tmp/cea-no-posthog/apps/web/package.json && echo "FAIL" || echo "PASS: no posthog dep"
grep "POSTHOG" /tmp/cea-no-posthog/.env.example && echo "FAIL" || echo "PASS: no posthog env vars"
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add template/
git commit -m "feat: make PostHog integration optional"
```

---

## Task 8: Chromatic Integration Conditionals

Chromatic only touches the Chromatic deploy step in `deploy.yml`.

**Files to modify:**

- `template/.github/workflows/deploy.yml`

- [ ] **Step 1: Wrap the Chromatic step in `template/.github/workflows/deploy.yml`**

```yaml
{% if use_chromatic %}
      - name: Deploy to Chromatic
        run: cd apps/web && pnpm chromatic --project-token={% raw %}${{ secrets.CHROMATIC_PROJECT_TOKEN }}{% endraw %}
{% endif %}
```

The `devDependencies` in `package.json` already has `chromatic` — wrap it conditionally:

In `template/apps/web/package.json` devDependencies:

```json
    {% if use_chromatic %}"chromatic": "^16.1.0",{% endif %}
```

- [ ] **Step 2: Scaffold without Chromatic and verify**

```bash
uvx copier copy . /tmp/cea-no-chromatic \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_chromatic=false \
  --defaults --overwrite

grep "chromatic" /tmp/cea-no-chromatic/.github/workflows/deploy.yml && echo "FAIL" || echo "PASS: no chromatic step"
grep '"chromatic"' /tmp/cea-no-chromatic/apps/web/package.json && echo "FAIL" || echo "PASS: no chromatic dep"
```

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add template/
git commit -m "feat: make Chromatic integration optional"
```

---

## Task 9: Marimo Integration Conditionals

**Files to modify:**

- `template/apps/api/pyproject.toml` (already handled in Task 5 — verify marimo block present)
- `template/justfile`

(`notebooks/` is excluded via `_exclude` in `copier.yaml`.)

- [ ] **Step 1: Verify Marimo dep block in `template/apps/api/pyproject.toml`**

The `{% if use_marimo %}` block was added in Task 5. Verify it's present:

```bash
grep -A2 "use_marimo" template/apps/api/pyproject.toml
```

Expected output includes `"marimo>=0.0.1"`.

- [ ] **Step 2: Wrap notebook command in `template/justfile`**

```just
{% if use_marimo %}
# Marimo notebook server
notebook:
    uv run --no-env-file marimo edit notebooks/
{% endif %}
```

- [ ] **Step 3: Create `template/notebooks/.gitkeep`**

This directory is only copied when `use_marimo=true` (via `_exclude`):

```bash
mkdir -p template/notebooks
touch template/notebooks/.gitkeep
```

- [ ] **Step 4: Scaffold without Marimo and verify**

```bash
uvx copier copy . /tmp/cea-no-marimo \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_marimo=false \
  --defaults --overwrite

ls /tmp/cea-no-marimo/notebooks 2>/dev/null && echo "FAIL" || echo "PASS: notebooks excluded"
grep "marimo" /tmp/cea-no-marimo/apps/api/pyproject.toml && echo "FAIL" || echo "PASS: no marimo dep"
grep "notebook:" /tmp/cea-no-marimo/justfile && echo "FAIL" || echo "PASS: no notebook command"
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add template/
git commit -m "feat: make Marimo integration optional"
```

---

## Task 10: Deployment Integration Conditionals

Add `vercel.json` and `render.yaml` to the template and make deploy.yml conditional.
Vercel and Render use their GitHub integrations — no CI deploy steps needed, only config files.

**Files to create/modify:**

- Create: `template/vercel.json`
- Create: `template/render.yaml`
- Modify: `template/.github/workflows/deploy.yml`
- Modify: `template/.env.example`

- [ ] **Step 1: Create `template/vercel.json`**

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "rootDirectory": "apps/web"
}
```

(This file is excluded when `use_vercel=false` via `_exclude` in `copier.yaml`.)

- [ ] **Step 2: Create `template/render.yaml`**

```yaml
services:
  - type: web
    name: {{ project_name }}-api
    runtime: python
    rootDir: apps/api
    buildCommand: pip install uv && uv sync
    startCommand: uv run uvicorn src.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: ENVIRONMENT
        value: production
{% if use_neon %}
      # DATABASE_URL should point to your Neon connection string — set in Render dashboard
{% endif %}
```

(This file is excluded when `use_render=false` via `_exclude` in `copier.yaml`.)

- [ ] **Step 3: Update `template/.env.example` for Neon**

At the bottom of the database section:

```bash
{% if use_neon %}
# Production database (Neon) — set in hosting platform env vars, not here
# DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
{% endif %}
```

- [ ] **Step 4: Scaffold with Vercel + Render + Neon and verify**

```bash
uvx copier copy . /tmp/cea-with-deploy \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_vercel=true \
  --data use_render=true \
  --data use_neon=true \
  --defaults --overwrite

ls /tmp/cea-with-deploy/vercel.json && echo "PASS: vercel.json present" || echo "FAIL"
ls /tmp/cea-with-deploy/render.yaml && echo "PASS: render.yaml present" || echo "FAIL"
grep "neon" /tmp/cea-with-deploy/.env.example && echo "PASS: neon note present" || echo "FAIL"
```

- [ ] **Step 5: Scaffold without deployment and verify files excluded**

```bash
uvx copier copy . /tmp/cea-no-deploy \
  --data project_name=test-app \
  --data project_description="Test" \
  --data use_vercel=false \
  --data use_render=false \
  --data use_chromatic=false \
  --defaults --overwrite

ls /tmp/cea-no-deploy/vercel.json 2>/dev/null && echo "FAIL" || echo "PASS: vercel.json excluded"
ls /tmp/cea-no-deploy/render.yaml 2>/dev/null && echo "FAIL" || echo "PASS: render.yaml excluded"
ls /tmp/cea-no-deploy/.github/workflows/deploy.yml 2>/dev/null && echo "FAIL" || echo "PASS: deploy.yml excluded"
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add template/
git commit -m "feat: add Vercel, Render, and Neon deployment integration support"
```

---

## Task 11: Write `hooks/post_copy.py` (TDD)

**Files:**

- Create: `hooks/post_copy.py`
- Create: `tests/test_post_copy.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_post_copy.py`:

```python
"""Tests for the post_copy hook: SETUP.md generation and terminal summary."""
import pytest
from hooks.post_copy import get_answers, generate_setup_md, print_summary


# ── get_answers ───────────────────────────────────────────────────────────────

def test_get_answers_defaults_when_env_unset(monkeypatch):
    for key in ["project_name", "use_clerk", "use_sentry", "use_posthog",
                "use_chromatic", "use_marimo", "use_vercel", "use_render", "use_neon"]:
        monkeypatch.delenv(key, raising=False)
    answers = get_answers()
    assert answers["project_name"] == "my-app"
    assert answers["use_clerk"] is False
    assert answers["use_sentry"] is False


def test_get_answers_parses_true(monkeypatch):
    monkeypatch.setenv("project_name", "my-project")
    monkeypatch.setenv("use_clerk", "true")
    monkeypatch.setenv("use_sentry", "True")
    answers = get_answers()
    assert answers["project_name"] == "my-project"
    assert answers["use_clerk"] is True
    assert answers["use_sentry"] is True


def test_get_answers_parses_false(monkeypatch):
    monkeypatch.setenv("use_posthog", "false")
    monkeypatch.setenv("use_render", "False")
    answers = get_answers()
    assert answers["use_posthog"] is False
    assert answers["use_render"] is False


# ── generate_setup_md ─────────────────────────────────────────────────────────

def _answers(**overrides):
    base = {
        "project_name": "test-app",
        "use_clerk": False,
        "use_sentry": False,
        "use_posthog": False,
        "use_chromatic": False,
        "use_marimo": False,
        "use_vercel": False,
        "use_render": False,
        "use_neon": False,
    }
    return {**base, **overrides}


def test_setup_md_always_includes_prerequisites():
    content = generate_setup_md(_answers())
    assert "Docker Desktop" in content
    assert "https://docs.docker.com/get-docker/" in content
    assert "https://docs.astral.sh/uv/" in content
    assert "https://pnpm.io/installation" in content
    assert "https://just.systems" in content
    assert "just setup" in content


def test_setup_md_includes_only_selected_dev_integrations():
    content = generate_setup_md(_answers(use_clerk=True, use_posthog=True))
    assert "### Clerk" in content
    assert "### PostHog" in content
    assert "### Sentry" not in content
    assert "### Chromatic" not in content
    assert "### Marimo" not in content


def test_setup_md_excludes_all_dev_integrations_when_none_selected():
    content = generate_setup_md(_answers())
    assert "## 2. Development Integrations" not in content


def test_setup_md_includes_only_selected_deployment_integrations():
    content = generate_setup_md(_answers(use_vercel=True, use_neon=True, use_render=True))
    assert "### Vercel" in content
    assert "### Render" in content
    assert "### Neon" in content


def test_setup_md_excludes_deployment_section_when_none_selected():
    content = generate_setup_md(_answers())
    assert "## 3. Deployment" not in content


def test_setup_md_secrets_checklist_shows_only_relevant_secrets():
    content = generate_setup_md(_answers(use_chromatic=True, use_vercel=True))
    assert "CHROMATIC_PROJECT_TOKEN" in content
    assert "VERCEL_TOKEN" in content
    assert "RENDER_API_KEY" not in content


def test_setup_md_secrets_checklist_absent_when_no_secrets_needed():
    content = generate_setup_md(_answers(use_marimo=True))
    assert "GitHub Actions Secrets" not in content


def test_setup_md_uses_project_name_in_heading():
    content = generate_setup_md(_answers(project_name="my-cool-app"))
    assert "# my-cool-app Setup Guide" in content


# ── print_summary ─────────────────────────────────────────────────────────────

def test_print_summary_shows_selected_integrations(capsys):
    print_summary(_answers(use_clerk=True, use_sentry=True))
    captured = capsys.readouterr()
    assert "Clerk" in captured.out
    assert "Sentry" in captured.out
    assert "PostHog" not in captured.out


def test_print_summary_shows_config_needed_for_clerk(capsys):
    print_summary(_answers(use_clerk=True))
    captured = capsys.readouterr()
    assert "CLERK_SECRET_KEY" in captured.out


def test_print_summary_shows_next_steps(capsys):
    print_summary(_answers(project_name="test-app"))
    captured = capsys.readouterr()
    assert "cd test-app" in captured.out
    assert "just setup" in captured.out
    assert "SETUP.md" in captured.out


def test_print_summary_no_config_section_when_no_external_config_needed(capsys):
    print_summary(_answers(use_marimo=True))
    captured = capsys.readouterr()
    assert "needing config" not in captured.out
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/test_post_copy.py -v 2>&1 | head -20
```

Expected: `ImportError` — `hooks.post_copy` does not exist yet.

- [ ] **Step 3: Write `hooks/post_copy.py`**

```python
#!/usr/bin/env python3
"""Post-copy hook: generates SETUP.md and prints terminal summary."""
import os
from pathlib import Path


def get_answers() -> dict:
    """Read Copier answers from environment variables (set by Copier before running hook)."""
    bool_keys = [
        "use_clerk", "use_sentry", "use_posthog", "use_chromatic",
        "use_marimo", "use_vercel", "use_render", "use_neon",
    ]
    answers: dict = {"project_name": os.environ.get("project_name", "my-app")}
    for key in bool_keys:
        answers[key] = os.environ.get(key, "false").lower() == "true"
    return answers


def generate_setup_md(answers: dict) -> str:
    """Generate SETUP.md content tailored to selected integrations."""
    project_name = answers["project_name"]
    sections: list[str] = [f"# {project_name} Setup Guide\n"]

    # ── Section 1: Local Development (always included) ────────────────────────
    sections.append("""## 1. Local Development

### Prerequisites

Install these before running `just setup`:

- [Docker Desktop](https://docs.docker.com/get-docker/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/) — Python package manager
- [pnpm](https://pnpm.io/installation) — Node package manager
- [just](https://just.systems/man/en/packages.html) — command runner

### First run

```bash
cp .env.example .env.local
# Fill in any required integration keys (see sections below)
just setup
just dev
```
""")

    # ── Section 2: Development Integrations ───────────────────────────────────
    dev_sections: list[str] = []

    if answers["use_clerk"]:
        dev_sections.append("""### Clerk

1. Create an account at [clerk.com](https://clerk.com) and create an application.
2. Copy keys to `.env.local`:
   - `CLERK_SECRET_KEY`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. Configure redirect URLs in the Clerk dashboard.
""")

    if answers["use_sentry"]:
        dev_sections.append("""### Sentry

1. Create two projects at [sentry.io](https://sentry.io): one Python, one Next.js.
2. Run the Sentry wizard in `apps/web/`:
   ```bash
   cd apps/web && npx @sentry/wizard@latest -i nextjs
   ```
3. Set `SENTRY_DSN` in `.env.local` (API) and in your hosting platform env vars.
""")

    if answers["use_posthog"]:
        dev_sections.append("""### PostHog

1. Create an account at [posthog.com](https://posthog.com).
2. Run the PostHog wizard in `apps/web/` (verify command against current docs):
   ```bash
   cd apps/web && npx @posthog/wizard@latest
   ```
3. Set `NEXT_PUBLIC_POSTHOG_KEY` in `.env.local`.
""")

    if answers["use_chromatic"]:
        dev_sections.append("""### Chromatic

1. Create an account at [chromatic.com](https://www.chromatic.com) and link your repo.
2. Publish your first build:
   ```bash
   cd apps/web && npx chromatic --project-token=<your-token>
   ```
3. Add `CHROMATIC_PROJECT_TOKEN` to GitHub Actions secrets.
""")

    if answers["use_marimo"]:
        dev_sections.append("""### Marimo

No external account needed. Start the notebook server with:

```bash
just notebook
```
""")

    if dev_sections:
        sections.append("## 2. Development Integrations\n")
        sections.extend(dev_sections)

    # ── Section 3: Deployment ─────────────────────────────────────────────────
    deploy_sections: list[str] = []

    if answers["use_vercel"]:
        deploy_sections.append("""### Vercel (web)

1. Import your repo at [vercel.com](https://vercel.com) — set the root directory to
   `apps/web`. Vercel will deploy automatically on push to master via GitHub integration.
2. Set all `NEXT_PUBLIC_*` and auth-related env vars in the Vercel dashboard.
""")

    if answers["use_render"]:
        deploy_sections.append("""### Render (API)

1. Create a Web Service at [render.com](https://render.com) — set the root directory to
   `apps/api`. Render deploys automatically on push to master via GitHub integration.
2. Set `DATABASE_URL` and all API env vars in the Render environment.
""")

    if answers["use_neon"]:
        deploy_sections.append("""### Neon (managed Postgres)

1. Create a project at [neon.tech](https://neon.tech).
2. Replace `DATABASE_URL` in Render with the Neon connection string.
3. Run migrations against production before first deploy:
   ```bash
   DATABASE_URL=<neon-connection-string> just db-migrate
   ```
""")

    if deploy_sections:
        sections.append("## 3. Deployment\n")
        sections.extend(deploy_sections)

    # ── Section 4: GitHub Actions Secrets Checklist ───────────────────────────
    secrets: list[tuple[str, str]] = []
    if answers["use_chromatic"]:
        secrets.append(("CHROMATIC_PROJECT_TOKEN", "Chromatic step in `deploy.yml`"))

    if secrets:
        checklist = "## 4. GitHub Actions Secrets Checklist\n\n"
        checklist += "| Secret | Required by |\n|--------|-------------|\n"
        for secret, required_by in secrets:
            checklist += f"| `{secret}` | {required_by} |\n"
        checklist += "\nAdd these at: GitHub repo → Settings → Secrets and variables → Actions\n"
        sections.append(checklist)

    return "\n".join(sections)


def print_summary(answers: dict) -> None:
    """Print a concise post-scaffold summary to the terminal."""
    project_name = answers["project_name"]

    integration_keys = [
        ("use_clerk", "Clerk"),
        ("use_sentry", "Sentry"),
        ("use_posthog", "PostHog"),
        ("use_chromatic", "Chromatic"),
        ("use_marimo", "Marimo"),
        ("use_vercel", "Vercel"),
        ("use_render", "Render"),
        ("use_neon", "Neon"),
    ]
    selected = [name for key, name in integration_keys if answers[key]]

    config_needed: list[str] = []
    if answers["use_clerk"]:
        config_needed.append(
            "→ Clerk    CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  (.env.local)"
        )
    if answers["use_sentry"]:
        config_needed.append(
            "→ Sentry   SENTRY_DSN  (.env.local)  +  run: npx @sentry/wizard@latest -i nextjs"
        )
    if answers["use_posthog"]:
        config_needed.append(
            "→ PostHog  NEXT_PUBLIC_POSTHOG_KEY  (.env.local)"
        )

    print(f"\n✔ Project scaffolded\n")

    if selected:
        print(f"  Integrations: {', '.join(selected)}\n")

    print(f"  Next steps:")
    print(f"    cd {project_name}")
    print(f"    just setup\n")

    if config_needed:
        print("  Integrations needing config before `just setup`:")
        for line in config_needed:
            print(f"    {line}")
        print()

    print("  Full instructions: SETUP.md\n")


if __name__ == "__main__":
    answers = get_answers()
    setup_content = generate_setup_md(answers)
    Path("SETUP.md").write_text(setup_content)
    print_summary(answers)
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
uv run pytest tests/test_post_copy.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/post_copy.py tests/test_post_copy.py
git commit -m "feat: add post_copy hook with SETUP.md generation and terminal summary"
```

---

## Task 12: Write READMEs

**Files:**

- Create: `README.md` (template repo)
- Modify: `template/README.md` (generated project)

- [ ] **Step 1: Write the template repo `README.md`**

```markdown
# create-eggscaliber-app

Scaffold a new full-stack project based on [eggscaliber-lite](https://github.com/you/eggscaliber-lite)
in minutes. Built on [Copier](https://copier.readthedocs.io/).

## Usage

```bash
uvx copier copy gh:you/create-eggscaliber-app ./my-project
```

Copier will prompt for:

- **Project name** — used in package names and database names
- **Project description**
- **Development integrations** — Clerk, Sentry, PostHog, Chromatic, Marimo
- **Deployment integrations** — Vercel, Render, Neon

After scaffolding, follow the generated `SETUP.md` in your new project.

## Pin to a specific version

```bash
uvx copier copy --vcs-ref=v1.0.0 gh:you/create-eggscaliber-app ./my-project
```

## Local testing

```bash
git clone https://github.com/you/create-eggscaliber-app
cd create-eggscaliber-app
uv sync
just dev   # interactive scaffold to ./test-output
just test  # scaffold with all integrations to /tmp/cea-test-output
just unit  # run pytest unit tests
```

## Releasing a new version

```bash
git tag v1.x.x
git push --tags
```

No registry publish needed — users pull directly from GitHub.

## Adding a new integration

1. Add a `use_<name>:` question to `copier.yaml`
2. Add `_exclude` entries for files that should be omitted
3. Add Jinja2 conditionals to any shared files that need modifying
4. Add a section to `generate_setup_md()` in `hooks/post_copy.py`
5. Add a line to `print_summary()` for config-needed entries if applicable
6. Add tests to `tests/test_post_copy.py`
7. Test with `just test` and `just unit`
8. Tag a new release
```

- [ ] **Step 2: Write `template/README.md` (the generated project README)**

```markdown
# {{ project_name }}

{{ project_description }}

## Getting started

See [SETUP.md](SETUP.md) for full setup instructions including prerequisites and
integration configuration.

### Quick start (after completing SETUP.md)

```bash
just dev       # start API (localhost:8000) + web (localhost:3000) concurrently
just test      # run all tests
just storybook # component explorer (localhost:6006)
```

See `just --list` for all available commands.

## Keeping up with the template

This project was scaffolded from
[create-eggscaliber-app](https://github.com/you/create-eggscaliber-app).
To pull in template improvements:

```bash
uvx copier update
```

Run from the project root. Copier re-applies template changes while preserving your
project-specific modifications.

**Important:** Do not delete `.copier-answers.yml` — it records your original answers and
template ref, and is required for `copier update` to work correctly.

To pin an update to a specific template version:

```bash
uvx copier update --vcs-ref=v1.x.x
```
```

- [ ] **Step 3: Commit**

```bash
git add README.md template/README.md
git commit -m "docs: add template repo README and generated project README"
```

---

## Task 13: End-to-End Integration Test

Run `just test` to scaffold with all integrations and verify the output is a valid project
that can run `just setup`.

**Prerequisites:** Docker must be running locally.

- [ ] **Step 1: Run the full scaffold**

```bash
just test
```

Expected: completes without errors, output at `/tmp/cea-test-output`.

- [ ] **Step 2: Verify no `eggscaliber` references remain**

```bash
grep -r "eggscaliber" /tmp/cea-test-output/ \
  --exclude=".copier-answers.yml" \
  --include="*.py" --include="*.ts" --include="*.tsx" \
  --include="*.yml" --include="*.yaml" --include="*.toml" \
  --include="*.json" --include="*.md"
```

Expected: no output.

- [ ] **Step 3: Verify key integration files are present**

```bash
ls /tmp/cea-test-output/apps/web/sentry.client.config.ts && echo "PASS: sentry present"
ls /tmp/cea-test-output/apps/web/src/middleware.ts && echo "PASS: clerk middleware present"
ls /tmp/cea-test-output/vercel.json && echo "PASS: vercel.json present"
ls /tmp/cea-test-output/render.yaml && echo "PASS: render.yaml present"
ls /tmp/cea-test-output/notebooks/.gitkeep && echo "PASS: notebooks present"
```

Expected: all PASS.

- [ ] **Step 4: Verify no-integration scaffold has clean output**

```bash
uvx copier copy . /tmp/cea-minimal \
  --data project_name=minimal-app \
  --data project_description="Minimal" \
  --data use_clerk=false \
  --data use_sentry=false \
  --data use_posthog=false \
  --data use_chromatic=false \
  --data use_marimo=false \
  --data use_vercel=false \
  --data use_render=false \
  --data use_neon=false \
  --defaults --overwrite

ls /tmp/cea-minimal/apps/web/sentry.client.config.ts 2>/dev/null && echo "FAIL" || echo "PASS"
ls /tmp/cea-minimal/.github/workflows/deploy.yml 2>/dev/null && echo "FAIL" || echo "PASS"
ls /tmp/cea-minimal/vercel.json 2>/dev/null && echo "FAIL" || echo "PASS"
```

Expected: all PASS.

- [ ] **Step 5: Run unit tests one final time**

```bash
just unit
```

Expected: all tests pass.

- [ ] **Step 6: Final commit and tag**

```bash
git add -A
git commit -m "chore: complete create-eggscaliber-app v0.1.0"
git tag v0.1.0
```

- [ ] **Step 7: Create GitHub repo and push**

```bash
gh repo create create-eggscaliber-app --public --source=. --remote=origin --push
git push origin master --tags
```

---

## Self-Review Notes

- **Spec coverage check:** All 5 dev integrations (Clerk, Sentry, PostHog, Chromatic, Marimo)
  and 3 deployment integrations (Vercel, Render, Neon) have tasks. SETUP.md, terminal summary,
  both READMEs, and copier.yaml are covered.
- **GitHub Actions escaping:** Every `${{ }}` in workflow files must be wrapped with
  `{% raw %}...{% endraw %}`. Verify this is done in Task 4 Steps 6 and 7.
- **project_name filter:** The `replace('-', '_')` filter is used consistently for DB names
  throughout. Verify all DB name references use it.
- **Copier version pinning:** Task 1 Step 2 instructs the implementer to check the latest
  version — the version in Task 1 Step 3 is a placeholder to be replaced.
