# AuthN & AuthZ Design

**Sub-project 8 — Eggscaliber-Lite**
**Date:** 2026-04-20

---

## Overview

This sub-project adds a full identity and access control layer using Clerk as the identity provider. It is split into two phases: Phase 1 delivers the complete identity stack (login, org, invites); Phase 2 delivers group-based package access control.

---

## Phasing

### Phase 1 — Identity Stack

- Clerk wired to Next.js: sign-in, sign-up, `<UserProfile />` account management
- Next.js middleware protects all app routes
- FastAPI verifies Clerk JWTs on every protected request
- `users` and `organisations` tables synced from Clerk via webhooks
- `org_memberships` table kept in sync via webhooks
- Org creation flow — any user can create or join an org
- Org invite flow — org admins invite by email via Clerk's built-in UI
- Dev bypass remains: `AUTH_MODE=dev` skips JWT verification locally

### Phase 2 — Access Control

- `groups` table: org-scoped groups managed in your DB
- `group_memberships` join table: which users belong to which groups
- `group_packages` join table: which packages a group can access
- Org admins assign users to groups via app UI
- Analytics and package endpoints filter results by the requesting user's group memberships
- App-level super-user role for managing all orgs and packages

---

## Architecture

### Frontend (Next.js)

`clerkMiddleware()` in `middleware.ts` protects all app routes. Protected paths: `/analytics`, `/datasets`, `/ai`. Public paths: `/`, `/sign-in`, `/sign-up`. `<ClerkProvider>` wraps the root layout.

Clerk components used:
- `<SignIn />` at `/sign-in`
- `<SignUp />` at `/sign-up`
- `<UserProfile />` at `/account`
- `<OrganizationSwitcher />` in the nav bar
- `<CreateOrganization />` for org creation
- `<OrganizationProfile />` for org admin (includes invite UI)

No custom auth UI is built — all identity screens use Clerk's hosted components.

### Backend (FastAPI)

A `get_current_user` dependency is added to `src/auth.py`. It:

1. Extracts the Bearer token from `Authorization` header
2. Fetches Clerk's JWKS (cached; refreshed on key rotation)
3. Verifies the JWT signature and expiry
4. Returns a `CurrentUser` dataclass with `clerk_id`, `email`, and `org_id`

When `AUTH_MODE=dev`, the dependency returns a hardcoded `CurrentUser` without any JWT verification. This preserves the existing local dev workflow.

Protected routes declare:

```python
current_user: CurrentUser = Depends(get_current_user)
```

Unprotected routes (health, webhooks) do not declare this dependency.

### Webhooks

`POST /api/v1/webhooks/clerk` receives Clerk events. The endpoint:
- Verifies the `svix-signature` header using `CLERK_WEBHOOK_SECRET`
- Routes by event `type` to the appropriate sync handler
- Is not protected by `get_current_user`

Events handled in Phase 1:
- `user.created` → insert into `users`
- `user.updated` → update `users`
- `organization.created` → insert into `organisations`
- `organizationMembership.created` → upsert into `org_memberships`
- `organizationMembership.deleted` → delete from `org_memberships`

---

## Data Model

### Phase 1 Tables

```sql
users
  id            SERIAL PRIMARY KEY
  clerk_id      TEXT UNIQUE NOT NULL       -- Clerk's "sub" claim
  email         TEXT NOT NULL
  display_name  TEXT
  created_at    TIMESTAMPTZ DEFAULT now()

organisations
  id            SERIAL PRIMARY KEY
  clerk_org_id  TEXT UNIQUE NOT NULL       -- Clerk's "org_id" claim
  name          TEXT NOT NULL
  created_at    TIMESTAMPTZ DEFAULT now()

org_memberships
  id            SERIAL PRIMARY KEY
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  org_id        INT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE
  role          TEXT NOT NULL              -- "admin" | "member"
  UNIQUE (user_id, org_id)
```

### Phase 2 Tables

```sql
groups
  id            SERIAL PRIMARY KEY
  org_id        INT NOT NULL REFERENCES organisations(id) ON DELETE CASCADE
  name          TEXT NOT NULL

group_memberships
  group_id      INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE
  user_id       INT NOT NULL REFERENCES users(id) ON DELETE CASCADE
  PRIMARY KEY (group_id, user_id)

group_packages
  group_id      INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE
  package_id    INT NOT NULL REFERENCES packages(id) ON DELETE CASCADE
  PRIMARY KEY (group_id, package_id)
```

**Key decisions:**
- Clerk is the source of truth for identity; the DB is a read replica of what matters for access control
- `clerk_id` / `clerk_org_id` are the foreign keys between Clerk and your DB
- Phase 2 tables are entirely in your DB — Clerk has no knowledge of groups or package assignments

---

## Auth Flows

### Sign-in / Sign-up

Standard Clerk hosted UI. On first sign-up, `user.created` fires → webhook syncs a row into `users`. Middleware redirects unauthenticated requests to `/sign-in`.

### Org Creation & Switching

Any user can create an org via `<CreateOrganization />`. `organization.created` fires → webhook syncs into `organisations`. The nav bar `<OrganizationSwitcher />` allows users with multiple orgs to switch context. The active org's `org_id` is included in every Clerk JWT automatically.

### Org Invite Flow

Org admins send invites via `<OrganizationProfile />` (built-in invite-by-email UI). Clerk handles the invite email, token, and acceptance. On acceptance, `organizationMembership.created` fires → webhook syncs into `org_memberships`. No custom email or invite-token code needed.

### Dev Bypass

`AUTH_MODE=dev` in `.env.local` causes `get_current_user` to return a fixed dev `CurrentUser`. No Clerk credentials are needed for local development.

---

## New Environment Variables

```
# Phase 1 (production)
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Sign-in/sign-up redirect URLs (Clerk dashboard config)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/analytics
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/analytics
```

All already stubbed as comments in `.env.example`.

---

## Testing

### Backend

- `get_current_user` is overridden in `conftest.py` with a fixed `CurrentUser` fixture — same pattern as the `dev` bypass. No real JWTs in tests.
- Webhook handler tests generate real `svix` signatures with a test secret to verify the verification logic actually runs.
- Phase 2: access control tests inject different `CurrentUser` fixtures with different group memberships to assert filtering behaviour.

### Frontend

- Clerk's `@clerk/testing` package provides mock auth state for component tests.
- Middleware logic is thin (just `clerkMiddleware()` + route config) — unit testing is low value; Playwright E2E covers redirect behaviour.

### What Is Not Tested

- Clerk's own UI components — that is Clerk's responsibility.
- Webhook delivery — handlers are tested in isolation; Clerk's webhook infrastructure is not simulated.

---

## Roadmap Update

Sub-project 8 is split into two iterations in the roadmap:

| Iteration | Description | Status |
|-----------|-------------|--------|
| Phase 1 — Identity Stack | Clerk wired end-to-end, protected routes, webhook sync, org + invite flows | ⏳ Pending |
| Phase 2 — Access Control | Groups in DB, group→package assignments, filtered endpoints | ⏳ Pending |
