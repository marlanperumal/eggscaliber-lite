# Sub-project 10 — Verify Existing Functionality

**Status:** Draft
**Date:** 2026-04-23
**Roadmap entry:** `docs/ROADMAP.md` §10

## Purpose

Audit sub-projects 3, 6, 7, 8, 9 against their own specs. Each spec declared behaviour that was either marked in-scope and may not have landed, or was deferred to a sub-project that has since been marked complete without explicit confirmation. This sub-project resolves that uncertainty item-by-item before moving on to the larger V2 / hardening work.

The goal is confidence, not perfection: every listed item ends this sub-project with a known status, and anything non-trivial has a plan rather than a silent gap.

## Approach — hybrid fix / spin-out

For each item:

1. **Verify in code.** Read the relevant routes/services/components and — where fast — exercise the flow (curl for endpoints, `agent-browser` for UI).
2. **Add a test where practical.**
   - Backend behaviour (filtering, entitlements, webhook handlers, token hashing, stream shape): add a pytest. These are cheap and high-signal.
   - UI-shape items (e.g. multi-response chips render as expandable branches): prefer a targeted unit test or Storybook story over a full E2E. Skip where the cost of an E2E harness is disproportionate to the risk.
3. **Classify the outcome:**
   - ✅ **Verified** — behaviour is present and now has a test (where practical).
   - 🔧 **Fix inline** — behaviour is missing or broken and the fix is <1 hour of implementation work. Write a failing test first where practical, fix, commit.
   - 📋 **Spin-out** — fix is larger than 1 hour. File a concrete follow-up plan, or fold the item into an existing planned sub-project (Ingestion V2, AI V2, etc.) with a link. Mark the item spun-out and move on.
4. **No separate audit harness.** All regression tests land in the existing pytest / vitest suites so they run on every push.

The <1 hour bar is deliberately tight. This sub-project is about verification, not repair. Anything non-trivial gets scoped properly as its own plan rather than smuggled in here.

## Scope

### Phase 0 — Triage stale deferrals

Before the main audit, classify each deferral as ✅ / 🔧 / 📋 so scope is visible up front:

- Clerk `useUser()` wired into top-nav avatar (real profile image, not placeholder)
- AI conversation persistence (multi-turn history survives page reload)
- AI per-user/org access control (AI tools honour group entitlements)
- Enhanced home page — originally "UX Polish Iteration 4"

### Phase 1 — Sub-project 8 (AuthZ)

- **Package filtering.** All data endpoints (`/api/v1/packages`, `/api/v1/analytics/*`, `/api/v1/ai/chat`) filter returned data by the caller's group memberships and active `org_subscriptions` dates. A user in org A with no subscription to package P must not see P or any of its collections/datasets, via any of the three endpoints.
- **Default group auto-assignment.** The Clerk `organizationMembership.created` webhook adds the new member to the org's Default group. Verify the webhook handler, confirm the Default group exists for seed orgs, and test with a synthetic webhook payload.

### Phase 2 — Sub-project 6 (Ingestion)

- **Virtual list pagination.** The reconciliation step under "Show all" uses a cursor-based backend endpoint and `@tanstack/react-virtual` on the frontend. Verify both sides; confirm the list scrolls smoothly with >1000 items.
- **Bulk reconciliation.** `POST /api/v1/datasets/upload/{id}/reconcile/bulk` exists and the select-all flow hits it (rather than N individual calls).
- **Deep field-group nesting.** The metadata editor tree renders 4+ levels deep, and drag-drop between levels works at depth.

### Phase 3 — Sub-project 3 (Analytics)

- **Field tree hygiene.** Identifier and weight fields are excluded from the field tree rendered in the analytics query builder.
- **Weighted measure picker.** In Weighted mode, only fields of type `weight` appear in the measure dropdown.
- **Multi-response expansion.** Fields of type `multi_response` render as expandable branches in the tree, with each response option selectable as a child.
- **Filter logic.** Within a single field's filter, selected values combine with OR. Across fields, filters combine with AND. Verify via a backend test against the crosstab service.

### Phase 4 — Sub-project 7 (AI)

- **Agent system prompt.** Responses cite dataset names in the returned parts and are structured as multi-part output (text + table + chart where applicable), not a single blob.
- **"Open in Analytics".** The button in an AI result constructs a valid nuqs-encoded URL that, when followed, loads the equivalent query in the analytics engine.
- **SSE stream shape.** `/api/v1/ai/chat` emits text deltas, structured result parts, and a finish event in the shape the Vercel AI SDK client expects. Verify with a direct curl against the endpoint and a parser unit test.

### Phase 5 — Sub-project 9 (MCP)

- **Token hash verification.** PATs are stored as SHA-256 hashes; the middleware compares using constant-time compare and rejects unknown or revoked tokens.
- **Group entitlement filtering.** Tool responses (`list_packages`, `list_collections`, `list_datasets`, `describe_dataset`, `run_crosstab`, `run_trend`, `describe_field_tree`) are restricted to the PAT owner's entitled packages — the same filter layer as the HTTP API.
- **`last_used_at` update.** On each authenticated tool call, the PAT row's `last_used_at` advances. Async is fine (fire-and-forget); the test asserts the column moves within a short window.

## Non-goals

- Building new features. Spun-out items get their own plans.
- Refactoring code that already works.
- Performance work beyond what's needed to make a verification test meaningful.
- Producing a separate audit report document. The Done-when bar is per-item resolution visible via commit history and spun-out plans.

## Done when

Every item in Phases 0–5 is resolved to ✅ / 🔧 / 📋. All ✅ and 🔧 items have tests where practical, landed in the normal suites. All 📋 items have a linked follow-up plan or an explicit roll-in to an existing planned sub-project.
