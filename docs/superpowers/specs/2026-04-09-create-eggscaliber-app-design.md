# Design: create-eggscaliber-app

**Date:** 2026-04-09
**Status:** Approved

## Overview

A Copier-based project template that scaffolds a new full-stack project from `eggscaliber-lite` in minutes. Users select optional integrations during an interactive prompt; the template renders a tailored project with a `SETUP.md` guide and terminal summary for post-install configuration.

**User invocation:**
```bash
uvx copier copy gh:you/create-eggscaliber-app ./my-project
```

---

## 1. Repository Structure

A new public GitHub repo: `create-eggscaliber-app`. Separate from `eggscaliber-lite`.

```
create-eggscaliber-app/
├── copier.yaml               # questions, defaults, conditional logic
├── hooks/
│   └── post_copy.py          # generates SETUP.md, prints terminal summary
├── template/                 # the project scaffold (Jinja2-aware)
│   ├── apps/
│   │   ├── api/
│   │   └── web/
│   ├── docker/
│   ├── packages/
│   ├── .github/
│   │   └── workflows/
│   │       ├── pr.yml
│   │       └── deploy.yml
│   ├── justfile
│   ├── docker-compose.yml
│   ├── .env.example
│   └── README.md             # generated project README (Jinja2-aware)
├── justfile                  # just test — scaffolds into temp dir and verifies
├── pyproject.toml            # copier as dev dependency
└── README.md                 # template repo README
```

---

## 2. Template Approach

### File rendering

`copier.yaml` sets `_templates_suffix: ""` — all files are processed as Jinja2 templates, no `.jinja` suffix needed. Files keep their original extensions for full IDE and tooling support. Jinja2 `{% if %}` blocks inside YAML/TOML/JSON/Python files cause minor syntax highlighting noise but no functional issues.

### Conditional file exclusion

Entire files with no stripped form are excluded via `_exclude` in `copier.yaml` using Jinja2 conditions. Example:

```yaml
_exclude:
  - "{% if not use_sentry %}apps/web/sentry.*.config.ts{% endif %}"
  - "{% if not use_chromatic %}.github/workflows/chromatic.yml{% endif %}"
  - "{% if not use_marimo %}notebooks/{% endif %}"
```

### Conditional blocks inside files

Integration-specific content inside shared files is wrapped in Jinja2 conditionals:

```python
# pyproject.toml
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlmodel>=0.0.21",
{% if use_sentry %}
    "sentry-sdk[fastapi]>=2.0.0",
{% endif %}
{% if use_marimo %}
    "marimo>=0.0.1",
{% endif %}
]
```

### Project name substitution

`project_name` replaces all occurrences of `eggscaliber` / `eggscaliber-lite` throughout the template — DB names in `docker-compose.yml`, CI env vars, `package.json` name field, `pyproject.toml` name, etc.

---

## 3. `copier.yaml` Questions

```yaml
_templates_suffix: ""
_subdirectory: template

# --- Project identity ---

project_name:
  type: str
  help: Project name (lowercase, hyphens OK)
  placeholder: my-app

project_description:
  type: str
  help: One-line description of your project
  placeholder: A full-stack web application

# --- Development integrations ---

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

# --- Deployment integrations ---

use_vercel:
  type: bool
  help: "Include Vercel deployment for the web app?"
  default: false

use_render:
  type: bool
  help: "Include Render deployment for the API?"
  default: false

use_neon:
  type: bool
  help: "Include Neon managed Postgres for production? (recommended with Render)"
  default: false
  when: "{{ use_render }}"
```

---

## 4. Optional Integration Footprint

### Development integrations

| Integration | Files excluded | Files modified |
|-------------|----------------|----------------|
| Clerk | `middleware.ts`, auth route handlers | `package.json`, layout, `.env.example` |
| Sentry | `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` | `package.json`, `pyproject.toml`, `instrumentation.ts`, CI, `.env.example` |
| PostHog | PostHog provider file | `package.json`, layout, `.env.example` |
| Chromatic | Chromatic CI step | `pr.yml` |
| Marimo | `notebooks/` directory | `pyproject.toml`, `justfile` |

### Deployment integrations

| Integration | Files added/excluded | Files modified |
|-------------|----------------------|----------------|
| Vercel | `vercel.json` | `deploy.yml` (web deploy step) |
| Render | `render.yaml` | `deploy.yml` (API deploy step) |
| Neon | — | `deploy.yml` (migrate step), `.env.example` (production DB URL note) |

If neither Vercel nor Render is selected, `deploy.yml` is excluded entirely.

---

## 5. Post-Copy Hook (`hooks/post_copy.py`)

Runs after scaffolding completes. Reads selected integrations from Copier's answer variables (passed as environment variables to the hook process).

### Terminal summary

```
✔ Project scaffolded at ./my-project

  Integrations: Clerk, Sentry, PostHog, Vercel, Render

  Next steps:
    cd my-project
    just setup

  Integrations needing config before `just setup`:
    → Clerk    CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY  (.env.local)
    → Sentry   SENTRY_DSN  (.env.local)  +  run: npx @sentry/wizard@latest -i nextjs
    → PostHog  NEXT_PUBLIC_POSTHOG_KEY  (.env.local)

  Full instructions: SETUP.md
```

### `SETUP.md` structure

Generated in the project root. Only sections for selected integrations are included.

```markdown
# my-project Setup Guide

## 1. Local Development

### Prerequisites
Install these before running `just setup`:
- [Docker Desktop](https://docs.docker.com/get-docker/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [pnpm](https://pnpm.io/installation)
- [just](https://just.systems/man/en/packages.html)

### First run
cp .env.example .env.local
# fill in any required integration keys (see sections below)
just setup
just dev

## 2. Development Integrations

### Clerk
1. Create account at clerk.com → create application
2. Copy keys to `.env.local`:
   - CLERK_SECRET_KEY
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
3. Configure redirect URLs in the Clerk dashboard

### Sentry
1. Create two projects at sentry.io: one Python, one Next.js
2. Run: `npx @sentry/wizard@latest -i nextjs` in `apps/web/`
3. Set SENTRY_DSN in `.env.local` (API) and in your hosting platform env vars

### PostHog
1. Create account at posthog.com
2. Run the setup wizard: `npx @posthog/wizard@latest` in `apps/web/`
   (verify exact command against current PostHog Next.js docs)
3. Set NEXT_PUBLIC_POSTHOG_KEY in `.env.local`

### Chromatic
1. Run `npx chromatic --project-token=<token>` to link the repo
2. Add CHROMATIC_PROJECT_TOKEN to GitHub Actions secrets

### Marimo
- Run `just notebook` to start the notebook server — no external account needed

## 3. Deployment

### Vercel (web)
1. Import repo at vercel.com → set root directory to `apps/web`
2. Set all NEXT_PUBLIC_* and auth-related env vars in Vercel dashboard
3. Add VERCEL_TOKEN + VERCEL_ORG_ID + VERCEL_PROJECT_ID to GitHub Actions secrets
4. `deploy.yml` deploys automatically on merge to master

### Render (API)
1. Create Web Service at render.com → set root directory to `apps/api`
2. Set DATABASE_URL and all API env vars in Render environment
3. Add RENDER_API_KEY + RENDER_SERVICE_ID to GitHub Actions secrets

### Neon (managed Postgres)
1. Create project at neon.tech
2. Replace DATABASE_URL in Render (and any other production env) with the Neon connection string
3. Run migrations against production before first deploy:
   DATABASE_URL=<neon-url> just db-migrate

## 4. GitHub Actions Secrets Checklist

| Secret | Required by |
|--------|-------------|
| CHROMATIC_PROJECT_TOKEN | Chromatic CI step |
| VERCEL_TOKEN | deploy.yml — Vercel deploy |
| VERCEL_ORG_ID | deploy.yml — Vercel deploy |
| VERCEL_PROJECT_ID | deploy.yml — Vercel deploy |
| RENDER_API_KEY | deploy.yml — Render deploy |
| RENDER_SERVICE_ID | deploy.yml — Render deploy |
```

---

## 6. READMEs

### `create-eggscaliber-app` README (template repo)

Covers:
- Usage: `uvx copier copy gh:you/create-eggscaliber-app ./my-project`
- Available questions and defaults
- Local testing: `uvx copier copy . ./test-output` (scaffold from local path)
- Release workflow: tag a version → `git tag v1.x.x && git push --tags`
- How to contribute a new integration

### Generated project README

Covers:
- Standard project intro (project name + description, Jinja2-rendered)
- Prerequisites and `just setup` / `just dev` quickstart
- Link to `SETUP.md` for integration config
- `## Keeping up with the template` section:
  - Run `uvx copier update` from the project root to pull in template improvements
  - `.copier-answers.yml` records your original answers and template ref — do not delete it
  - Pin to a specific template version: `uvx copier update --vcs-ref=v1.x.x`

---

## 7. Publishing & Versioning

- **No registry needed.** Users run `uvx copier copy gh:you/create-eggscaliber-app ./my-project` — Copier is fetched ephemerally by `uvx`.
- **Releases are GitHub tags.** No publish step required.
- **Testing:** `just test` in the template repo scaffolds a project with all integrations enabled into a temp directory and verifies `just setup` completes without error.
- **Template updates:** Existing generated projects can pull in improvements via `uvx copier update`. Copier diffs the template at the recorded ref against the new version and applies changes, preserving project-specific modifications.
