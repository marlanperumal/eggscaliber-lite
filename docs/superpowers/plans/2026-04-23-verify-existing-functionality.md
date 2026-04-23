# Verify Existing Functionality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit sub-projects 3, 6, 7, 8, 9 against their specs, resolving each listed item to ✅ verified (with a test where practical) / 🔧 fixed inline / 📋 spun out to a follow-up plan.

**Architecture:** Verification-centric, not build-centric. Each task reads the relevant code, exercises the behaviour, classifies the outcome, and then either adds a regression test, writes a failing-test-first fix, or files a follow-up plan stub. No separate audit harness — all tests land in the existing `apps/api/tests/` and `apps/web/src/**/*.test.ts[x]` suites.

**Tech Stack:** pytest (backend), vitest + React Testing Library (frontend), Storybook for UI-shape checks, `agent-browser` CLI for manual UI verification, `curl` for endpoint checks.

**Spin-out threshold:** <1 hour of work = fix inline. Otherwise → 📋 follow-up plan at `docs/superpowers/plans/<date>-<topic>.md`.

---

## Plan-wide Conventions

**Classification template.** Every verification task ends in one of three outcomes:

- ✅ **Verified** — behaviour present. Add a regression test where practical.
- 🔧 **Fix inline** — behaviour broken, fix ≤1 hour. Write failing test first (where practical), fix, commit.
- 📋 **Spin-out** — behaviour broken, fix >1 hour. Write a stub plan at `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` (or open an issue-style section inside an existing planned sub-project spec like Ingestion V2 / AI V2), commit it, and move on.

**Spin-out stub format** — the stub is not a full plan, just enough for a future session to pick up:

```markdown
# <Topic> — Follow-up from Sub-project 10

**Surfaced by:** `docs/superpowers/plans/2026-04-23-verify-existing-functionality.md` Task N
**Current state:** <one paragraph of what exists>
**Gap:** <what's missing / broken>
**Estimated effort:** <rough>
**Next step:** brainstorm or plan directly

---
```

**Existing test patterns to copy.** When adding tests, match the style of these neighbours:

- Backend route+auth: `apps/api/tests/test_access_control.py`
- Backend webhook: `apps/api/tests/test_webhooks.py`
- Backend MCP: `apps/api/tests/test_mcp_auth.py`, `test_mcp_tools_access.py`
- Backend analytics service: `apps/api/tests/test_crosstab_service.py`, `test_field_tree.py`
- Frontend component: `apps/web/src/app/ai/AIChatPage.test.tsx`, `apps/web/src/app/analytics/FieldTreePanel.test.tsx`

**Commit style.** Per item, prefer one commit per resolution. Examples:

- `test(api): cover package entitlement filter on /analytics` (✅ added regression test)
- `fix(web): wire Clerk useUser into top-nav avatar` (🔧 inline)
- `docs: stub follow-up for AI conversation persistence` (📋 spin-out)

Run `just lint && just typecheck` before each commit. If the whole sub-project ends green, run the full pre-push checklist before closing it out.

---

## Task 0: Pre-flight

**Files:** none modified.

- [ ] **Step 1: Confirm clean tree and up-to-date master**

  ```bash
  git status
  git pull --ff-only
  ```

  Expected: working tree clean, up to date.

- [ ] **Step 2: Baseline — full test + lint suite passes**

  ```bash
  just test && just lint && just typecheck
  ```

  Expected: all green. If anything fails at baseline, fix or pin the failure before starting the audit (pre-existing flakiness makes verification ambiguous).

- [ ] **Step 3: Quick audit-log note**

  Create `docs/superpowers/plans/2026-04-23-verify-existing-functionality.notes.md` (untracked scratch file) where each completed task appends one line: `Task N — <item> — ✅|🔧|📋 — <commit-sha or spin-out path>`. This is the working log used to summarise progress; it does not need committing.

---

## Phase 0 — Triage Stale Deferrals

Four items that were deferred to a now-shipped sub-project. Classify each before starting Phase 1.

### Task 1: Clerk avatar in top-nav

**Files to read:**

- `apps/web/src/components/` (look for TopNav / Header component)
- `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Locate the top-nav component**

  ```bash
  grep -rn "UserButton\|useUser\|avatar" apps/web/src/components apps/web/src/app/layout.tsx | head -20
  ```

- [ ] **Step 2: Verify**

  Does the nav render the Clerk user's real `imageUrl` / name, or a placeholder? Open the app with `just web` + `agent-browser open http://localhost:3000` while signed in, snapshot the header.

- [ ] **Step 3: Classify**

  - ✅ Real avatar wired → add a render test that asserts the nav uses Clerk's `useUser()` data (mock `useUser` to return a fixture user and assert the avatar node has the expected `src`/`alt`). Pattern: any `*.test.tsx` under `apps/web/src/app/`.
  - 🔧 Placeholder still present → swap in `useUser()` (Clerk Next.js hook), render `UserButton` from `@clerk/nextjs` or a custom avatar bound to `user.imageUrl`. Commit.
  - 📋 Larger redesign needed → stub plan.

- [ ] **Step 4: Commit** using the appropriate commit style from the conventions section.

### Task 2: AI conversation persistence

**Files to read:**

- `apps/web/src/app/ai/AIChatPage.tsx`
- `apps/web/src/app/ai/useChat*` (if present)
- `apps/api/src/routes/ai.py`, `apps/api/src/services/ai_service.py`, `apps/api/src/models/` for any `conversations` / `messages` tables

- [ ] **Step 1: Check for a persistence layer**

  ```bash
  grep -rn "conversation\|message_history\|ChatMessage" apps/api/src/models apps/api/src/routes/ai.py apps/api/src/services/ai_service.py
  ```

- [ ] **Step 2: Exercise**

  `just dev`, sign in, send a chat message, reload the page. Does the history reappear?

- [ ] **Step 3: Classify**

  - ✅ History survives reload → regression is probably covered in `test_ai_routes.py`; confirm, add missing coverage if thin.
  - 📋 **Default expectation: spin-out.** Real persistence (schema + migration + hydration + pagination) is firmly >1h. Write a stub at `docs/superpowers/plans/2026-04-23-ai-conversation-persistence.md` referencing §16 AI Interface V2.

- [ ] **Step 4: Commit** the stub or coverage.

### Task 3: AI per-user/org access control

**Files to read:**

- `apps/api/src/routes/ai.py`
- `apps/api/src/services/ai_service.py`
- `apps/api/src/services/analytics_service.py` (AI likely reuses this layer)

- [ ] **Step 1: Trace the tool-call path**

  Does `ai_service` resolve a user/org context and pass it down to analytics/crosstab/trend calls so that group entitlement filtering applies? Grep for the same filter helper used by the HTTP routes (identified in Task 5).

- [ ] **Step 2: Classify**

  - ✅ Same filter layer as HTTP → add a pytest that POSTs to `/api/v1/ai/chat` as user-A (entitled to package P1 only) asking about a dataset in package P2 and asserts the response refuses / returns no data for P2. Pattern: `test_ai_routes.py` + auth fixtures from `test_access_control.py`.
  - 🔧 Filter bypassed on one code path → fix inline.
  - 📋 Fundamental rework required → stub plan.

- [ ] **Step 3: Commit.**

### Task 4: Enhanced home page

**Files to read:**

- `apps/web/src/app/HomePage.tsx`, `HomePage.test.tsx`, `HomePage.stories.tsx`, `apps/web/src/app/page.tsx`

- [ ] **Step 1: Compare against the Iteration 4 spec**

  Open `docs/superpowers/specs/` and search for the UX Polish Iteration 4 notes (likely in `2026-04-15-ux-polish-iteration-3.md` or the roadmap entry). What was promised?

- [ ] **Step 2: Classify**

  - ✅ Landing page delivers what was promised (CTA, redirect, or marketing shell) → nothing to do.
  - 📋 Significant redesign (animations, scroll-driven sections) → spin-out to Design System V2.

- [ ] **Step 3: Commit** the stub if needed.

---

## Phase 1 — Sub-project 8 (AuthZ)

### Task 5: Package filtering across `/packages`, `/analytics`, `/ai/chat`

This is the highest-blast-radius item in the whole audit. Treat any gap as a security bug.

**Files to read:**

- `apps/api/src/routes/packages.py`
- `apps/api/src/routes/analytics.py`
- `apps/api/src/routes/ai.py`
- `apps/api/src/services/package_service.py`
- `apps/api/src/services/analytics_service.py`
- `apps/api/src/services/ai_service.py`
- `apps/api/src/repositories/` — look for an entitlement helper
- `apps/api/tests/test_access_control.py` (existing coverage)
- `apps/api/tests/test_packages.py`, `test_analytics_routes.py`, `test_ai_routes.py`

**Test file to create/extend:** `apps/api/tests/test_access_control.py`

- [ ] **Step 1: Find the canonical filter**

  ```bash
  grep -rn "group_membership\|entitled\|subscription" apps/api/src/services apps/api/src/repositories
  ```

  Name the helper (e.g. `entitlement_repo.get_entitled_package_ids(user_id, org_id)`). If no single helper exists, that itself is a finding.

- [ ] **Step 2: Verify each of the three routes uses it**

  For each of `packages.py`, `analytics.py`, `ai.py`: identify where the handler gets the set of allowed package IDs. Confirm the filter is applied before query execution, not after (post-filtering leaks row counts via timing).

- [ ] **Step 3: Write the cross-endpoint regression test**

  For each endpoint, assert a user in an org with no active subscription to package P cannot see P or any descendant collections/datasets. Template:

  ```python
  async def test_packages_endpoint_filters_by_subscription(
      client: AsyncClient, db: AsyncSession
  ):
      user_a, org_a, pkg_unentitled = await seed_user_org_and_package(
          db, subscribed=False
      )
      resp = await client.get(
          "/api/v1/packages",
          headers=auth_header(user_a),
      )
      assert resp.status_code == 200
      body = resp.json()
      assert pkg_unentitled.id not in {p["id"] for p in body}
  ```

  Write equivalents for `/api/v1/analytics` (or the specific analytics sub-routes) and `/api/v1/ai/chat`. For the AI endpoint, assert the POST result does not leak the package name in the response parts.

- [ ] **Step 4: Run the tests**

  ```bash
  just test-api -k test_packages_endpoint_filters_by_subscription
  just test-api -k "filters_by_subscription"
  ```

  Expected (if ✅): all pass. If ✅: commit the tests as `test(api): cover package entitlement filter on <endpoints>`.

- [ ] **Step 5: If any test fails — classify and act**

  - 🔧 (<1h) if the fix is wiring an existing helper into one handler. Write the fix, run tests green, commit: `fix(api): apply entitlement filter to <endpoint>`.
  - 📋 (>1h) if the whole entitlement layer needs refactoring. Stub plan at `docs/superpowers/plans/2026-04-23-entitlement-layer-refactor.md` and mark 10 as blocked on it until the stub is resolved. Given the security nature of this item, a blocking spin-out is appropriate.

- [ ] **Step 6: Additionally expiry-window test**

  Subscriptions have `starts_at` / `ends_at`. Add one test asserting an expired subscription does not grant access. Same template; mutate the subscription row to `ends_at = now() - 1 day`.

- [ ] **Step 7: Commit and update the notes file.**

### Task 6: Default group auto-assignment on membership webhook

**Files to read:**

- `apps/api/src/routes/webhooks.py`
- `apps/api/src/services/user_service.py:40-70` (the `organizationMembership.created` branch)
- `apps/api/src/repositories/group_repo.py:28-90` (`get_default_group`, `add_user_to_default_group`)
- `apps/api/tests/test_webhooks.py:363` (`test_membership_created_adds_user_to_default_group`)

**Test file to extend:** `apps/api/tests/test_webhooks.py` (may already cover this)

- [ ] **Step 1: Inspect the existing test**

  ```bash
  just test-api -k test_membership_created_adds_user_to_default_group -v
  ```

  Expected: PASS. If it passes, this item is ✅ verified by an existing test — append the notes file and move on.

- [ ] **Step 2: Gap check — edge cases**

  Does the handler also cover: (a) membership created before the org's Default group exists (race), (b) membership created for an existing user already in a different group? If a gap exists, add a test in `test_webhooks.py`; fix inline if <1h.

- [ ] **Step 3: Commit.**

---

## Phase 2 — Sub-project 6 (Ingestion)

### Task 7: Virtual list pagination in reconciliation "Show all"

**Files to read:**

- `apps/web/src/app/datasets/upload/` — reconciliation step
- `apps/api/src/routes/uploads.py`, `apps/api/src/routes/datasets.py` — cursor-based endpoint
- `apps/api/tests/test_reconciliation_api.py`, `test_uploads.py`

- [ ] **Step 1: Locate the "Show all" UI**

  ```bash
  grep -rn "Show all\|show_all\|showAll" apps/web/src/app/datasets
  ```

- [ ] **Step 2: Confirm cursor-based backend + `@tanstack/react-virtual` frontend**

  Read the paginated endpoint — does it accept a cursor (not offset)? Does the component import `useVirtualizer` from `@tanstack/react-virtual`? Confirm both.

- [ ] **Step 3: Classify**

  - ✅ Both present → add a backend test asserting the cursor endpoint returns a `next_cursor` and respects it; frontend test can stay thin (rendering large mocked dataset and asserting only a windowed subset of rows is in the DOM).
  - 🔧 One side missing but small → fix inline.
  - 📋 Neither present → spin-out (this is real work).

- [ ] **Step 4: Commit.**

### Task 8: Bulk reconciliation endpoint

**Files to read:**

- `apps/api/src/routes/uploads.py` (look for `.../reconcile/bulk`)
- `apps/api/src/services/reconciliation_service.py`
- `apps/web/src/app/datasets/upload/` (select-all handler)
- `apps/api/tests/test_reconciliation_api.py`

- [ ] **Step 1: Endpoint exists?**

  ```bash
  grep -rn "reconcile/bulk\|bulk_reconcile" apps/api/src apps/web/src
  ```

- [ ] **Step 2: Frontend hits it on select-all?**

  Trace the select-all button; confirm it posts to `/reconcile/bulk`, not N calls.

- [ ] **Step 3: Classify and act** per the plan-wide template. If ✅, add a pytest that calls the bulk endpoint with a list of mappings and asserts all are applied in one transaction.

- [ ] **Step 4: Commit.**

### Task 9: Deep field-group nesting (4+ levels with drag-drop)

**Files to read:**

- `apps/web/src/app/datasets/upload/` (metadata editor tree)
- `apps/api/src/services/commit_service.py` (hierarchy commit)
- `apps/api/src/models/` (any depth constraint)

- [ ] **Step 1: Schema depth limit?**

  Grep models for `max_depth`, `level`, or recursive constraints. Confirm none cap depth at 3.

- [ ] **Step 2: Exercise via Storybook**

  ```bash
  just storybook
  ```

  If the metadata editor has a story, drag fields to build a 4-level hierarchy. If no story exists, load the upload flow via `just web` and construct a depth-4 hierarchy manually.

- [ ] **Step 3: Classify and act.** If ✅, add a Storybook story named `MetadataEditor — Deep Nesting` with a 4-level fixture; this serves as the regression artefact. If 🔧, fix the depth-limit code path.

- [ ] **Step 4: Commit.**

---

## Phase 3 — Sub-project 3 (Analytics)

### Task 10: Field tree hygiene — exclude identifier and weight fields

**Files to read:**

- `apps/api/src/services/analytics_service.py` or wherever `describe_field_tree` is assembled
- `apps/api/tests/test_field_tree.py` (existing coverage)
- `apps/web/src/app/analytics/FieldTreePanel.tsx`, `FieldTreePanel.test.tsx`

- [ ] **Step 1: Run the existing field-tree test**

  ```bash
  just test-api -k test_field_tree -v
  ```

- [ ] **Step 2: Add/confirm the exclusion assertion**

  Find the test that seeds a dataset with at least one `identifier` and one `weight` field, then asserts neither appears in the tree. If missing, add it:

  ```python
  async def test_field_tree_excludes_identifier_and_weight(db: AsyncSession):
      dataset = await seed_dataset_with_field_types(
          db,
          types=["identifier", "weight", "categorical"],
      )
      tree = await analytics_service.describe_field_tree(db, dataset_id=dataset.id)
      types_in_tree = {node.field_type for node in walk(tree)}
      assert "identifier" not in types_in_tree
      assert "weight" not in types_in_tree
      assert "categorical" in types_in_tree
  ```

- [ ] **Step 3: Classify and commit.**

### Task 11: Weighted measure picker shows only weight fields

**Files to read:**

- `apps/web/src/app/analytics/QueryBuilderPanel.tsx`, `QueryBuilderPanel.test.tsx`
- `apps/web/src/app/analytics/useAnalyticsState.ts`

- [ ] **Step 1: Locate the weighted-mode dropdown**

  ```bash
  grep -rn "Weighted\|value_field\|weight_field" apps/web/src/app/analytics
  ```

- [ ] **Step 2: Verify the filter**

  In the dropdown, is the options list filtered to `field_type === "weight"`?

- [ ] **Step 3: Test**

  Add a vitest that mounts `QueryBuilderPanel` in Weighted mode with a mixed field list and asserts only weight-typed options render. Pattern: `QueryBuilderPanel.test.tsx`.

- [ ] **Step 4: Commit.**

### Task 12: Multi-response expansion

**Files to read:**

- `apps/web/src/app/analytics/FieldTreePanel.tsx`, `FieldTreePanel.test.tsx`
- `apps/api/src/services/analytics_service.py` (tree shape for multi_response)

- [ ] **Step 1: Verify tree shape**

  Does `describe_field_tree` emit `multi_response` fields with child option nodes? Check `test_field_tree.py`.

- [ ] **Step 2: Frontend renders them as expandable branches?**

  Load a fixture with a `multi_response` field in Storybook, expand it, confirm children appear.

- [ ] **Step 3: Test and commit.** Add a vitest on `FieldTreePanel` asserting a multi_response node renders a disclosure toggle and exposes children when expanded.

### Task 13: Filter logic — OR within field, AND across fields

**Files to read:**

- `apps/api/src/services/crosstab_service.py`
- `apps/api/tests/test_crosstab_service.py`

- [ ] **Step 1: Add a discriminating pytest**

  If a test already asserts this, note it. Otherwise:

  ```python
  async def test_filter_logic_or_within_and_across(db: AsyncSession):
      dataset = await seed_dataset_with_rows(db, rows=[
          {"region": "N", "gender": "M"},
          {"region": "N", "gender": "F"},
          {"region": "S", "gender": "M"},
          {"region": "S", "gender": "F"},
      ])
      filters = [
          {"field": "region", "values": ["N", "S"]},   # OR within field
          {"field": "gender", "values": ["M"]},        # AND across fields
      ]
      rows = await crosstab_service.run(db, dataset.id, filters=filters, ...)
      assert total_rows(rows) == 2  # both regions, male only
  ```

- [ ] **Step 2: Run, classify, commit.**

---

## Phase 4 — Sub-project 7 (AI)

### Task 14: Agent system prompt — dataset citations and multi-part output

**Files to read:**

- `apps/api/src/services/ai_service.py` (system prompt + tool definitions)
- `apps/api/tests/test_ai_service.py`

- [ ] **Step 1: Locate the system prompt string and the response part schema**

- [ ] **Step 2: Test**

  Mock the LLM to return a canned multi-part response and assert the service emits distinct `text` + `table` parts, each with a `source_dataset` field populated. Pattern: existing tests in `test_ai_service.py`.

- [ ] **Step 3: Classify and commit.**

### Task 15: "Open in Analytics" URL correctness

**Files to read:**

- `apps/web/src/app/ai/InlineResult.tsx`, `InlineResult.test.tsx`
- `apps/web/src/app/analytics/useAnalyticsState.ts` (nuqs parser definition)

- [ ] **Step 1: Trace URL construction**

  How does `InlineResult` build the href? Does it use the same nuqs parser the analytics page uses?

- [ ] **Step 2: Test**

  Add a vitest that given a fixture AI result, renders `InlineResult`, finds the "Open in Analytics" link, and asserts `href` matches a URL that, when parsed by the same nuqs parser, yields the expected `QueryState`. Pattern: `InlineResult.test.tsx`.

- [ ] **Step 3: Classify and commit.**

### Task 16: SSE stream shape on `/api/v1/ai/chat`

**Files to read:**

- `apps/api/src/routes/ai.py`
- `apps/api/tests/test_ai_routes.py`

- [ ] **Step 1: Manual shape check**

  ```bash
  just api
  curl -N -X POST http://localhost:8000/api/v1/ai/chat \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $DEV_JWT" \
    -d '{"messages":[{"role":"user","content":"hello"}]}' | head -40
  ```

  Confirm the stream carries text deltas, at least one structured result part, and a finish event, in the format the Vercel AI SDK client expects.

- [ ] **Step 2: Parser unit test**

  Add a pytest that POSTs to `/ai/chat` with mocked LLM/tool responses and asserts the byte stream deserialises into the expected sequence of event types. Pattern: existing streaming tests in `test_ai_routes.py` (if any).

- [ ] **Step 3: Classify and commit.**

---

## Phase 5 — Sub-project 9 (MCP)

### Task 17: PAT token hash verification

**Files to read:**

- `apps/api/src/mcp_external/auth.py`
- `apps/api/src/services/token_service.py`
- `apps/api/tests/test_mcp_auth.py`, `test_tokens.py`

- [ ] **Step 1: Confirm hashing algorithm**

  SHA-256? Stored in `tokens` table as a hash column, never plaintext? Grep `hashlib.sha256` or `pbkdf2` / `bcrypt`.

- [ ] **Step 2: Confirm constant-time compare**

  `hmac.compare_digest` or equivalent, not `==`.

- [ ] **Step 3: Run existing tests**

  ```bash
  just test-api -k "test_mcp_auth or test_tokens"
  ```

- [ ] **Step 4: Gap check**

  Does a test explicitly assert that a revoked token (`revoked_at is not null`) is rejected? If not, add it. Pattern: `test_mcp_auth.py`.

- [ ] **Step 5: Classify and commit.**

### Task 18: MCP tools — group entitlement filtering

**Files to read:**

- `apps/api/src/mcp_external/tools/browse.py`, `tools/analyse.py`
- `apps/api/tests/test_mcp_tools_access.py`

- [ ] **Step 1: Trace each tool's data call**

  Confirm `list_packages`, `list_collections`, `list_datasets`, `describe_dataset`, `run_crosstab`, `run_trend`, `describe_field_tree` all route through the same entitlement-filtered service layer used by the HTTP routes (i.e., the helper identified in Task 5).

- [ ] **Step 2: Cross-PAT test**

  Add (if missing) a pytest asserting PAT-A (owner entitled to P1 only) calling `describe_dataset` with a dataset ID belonging to P2 receives an error or empty response, and cannot enumerate P2 via `list_packages`. Pattern: `test_mcp_tools_access.py`.

- [ ] **Step 3: Classify and commit.** If gaps exist and routing to the shared helper is a small wiring change → 🔧. If the MCP tools have their own divergent data layer → 📋.

### Task 19: `last_used_at` advances on each tool call

**Files to read:**

- `apps/api/src/mcp_external/auth.py` (middleware)
- `apps/api/src/services/token_service.py`

- [ ] **Step 1: Confirm the update path**

  Fire-and-forget (e.g. `asyncio.create_task`) is fine, blocking is fine — just confirm it happens on authenticated requests.

- [ ] **Step 2: Test**

  Add (if missing) a pytest that records `last_used_at`, makes a valid MCP tool call, and asserts the timestamp advanced within a 5-second window. Pattern:

  ```python
  async def test_pat_last_used_at_advances(client: AsyncClient, db: AsyncSession):
      pat, _ = await seed_pat(db)
      before = pat.last_used_at
      resp = await client.post(
          "/mcp/external",
          headers={"Authorization": f"Bearer {pat.plaintext}"},
          json=mcp_list_packages_payload(),
      )
      assert resp.status_code == 200
      await asyncio.sleep(0.2)  # allow fire-and-forget to land
      await db.refresh(pat)
      assert pat.last_used_at > before
  ```

- [ ] **Step 3: Classify and commit.**

---

## Task 20: Close out the sub-project

- [ ] **Step 1: Review the notes file**

  Read `docs/superpowers/plans/2026-04-23-verify-existing-functionality.notes.md`. Every task should have a status line.

- [ ] **Step 2: Pre-push checklist**

  ```bash
  just lint && just format-check && just typecheck && just build-storybook && just test
  ```

  All green.

- [ ] **Step 3: Mark sub-project 10 complete in the roadmap**

  Edit `docs/ROADMAP.md`: change row 10's status from `🔜 Next` to `✅ Complete`, add a `[plan](superpowers/plans/2026-04-23-verify-existing-functionality.md)` link, and in the §10 summary append a short outcome note: how many items resolved ✅ / 🔧 / 📋, and links to any spin-out plans.

- [ ] **Step 4: Pick the next sub-project**

  Set row 11 (Design System V2 & Mobile) to `🔜 Next` unless the spin-outs from this audit have reprioritised it.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/ROADMAP.md
  git commit -F /tmp/commit-msg.txt   # "docs: mark sub-project 10 complete"
  ```
