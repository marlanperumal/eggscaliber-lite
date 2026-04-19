# Address Test Audit Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address every finding from the test audit: add missing backend tests for `move_field` and `trigger_reconcile` edge cases, rename low-signal test names, and add frontend behavioral tests for `Step3Reconciliation` and `Step4MetadataEditor`.

**Architecture:** Five independent tasks, each self-contained. Backend tasks add/edit tests in `apps/api/tests/`. Frontend tasks create new test files colocated with their components. No production code changes required.

**Tech Stack:** pytest + pytest-asyncio (backend), Vitest + @testing-library/react + userEvent (frontend)

---

## Files

| Action | Path |
|--------|------|
| Modify | `apps/api/tests/test_uploads.py` |
| Modify | `apps/api/tests/test_reconciliation_api.py` |
| Create | `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.test.tsx` |
| Create | `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.test.tsx` |

---

## Task 1: Add `move_field` route tests

**Files:**
- Modify: `apps/api/tests/test_uploads.py` (append at end of file)

The `PATCH /uploads/{session_id}/fields/{field_id}/move` route has zero test coverage. It has a session-ownership check: if the field belongs to a different session it returns 404. Neither the happy path nor the error path is tested.

- [ ] **Step 1: Append the two new tests to `apps/api/tests/test_uploads.py`**

Add these two functions at the end of the file (after the last existing test):

```python
async def test_move_field_assigns_to_fieldgroup(client, db):
    csv_bytes = _make_csv(["q1", "q2"], [["a", "b"]])
    r = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "T"},
    )
    sid = r.json()["id"]
    field_id = r.json()["fields"][0]["id"]

    grp_r = await client.post(f"/api/v1/uploads/{sid}/fieldgroups", json={"name": "G1"})
    gid = grp_r.json()["id"]

    move_r = await client.patch(
        f"/api/v1/uploads/{sid}/fields/{field_id}/move",
        json={"upload_fieldgroup_id": gid},
    )
    assert move_r.status_code == 200
    assert move_r.json()["id"] == field_id
    assert move_r.json()["upload_fieldgroup_id"] == gid


async def test_move_field_with_wrong_session_returns_404(client, db):
    csv_bytes_a = _make_csv(["q1"], [["a"]])
    r_a = await client.post(
        "/api/v1/uploads",
        files={"file": ("a.csv", csv_bytes_a, "text/csv")},
        data={"dataset_name": "A"},
    )
    sid_a = r_a.json()["id"]
    field_id_a = r_a.json()["fields"][0]["id"]

    csv_bytes_b = _make_csv(["q1"], [["a"]])
    r_b = await client.post(
        "/api/v1/uploads",
        files={"file": ("b.csv", csv_bytes_b, "text/csv")},
        data={"dataset_name": "B"},
    )
    sid_b = r_b.json()["id"]

    move_r = await client.patch(
        f"/api/v1/uploads/{sid_b}/fields/{field_id_a}/move",
        json={"upload_fieldgroup_id": None},
    )
    assert move_r.status_code == 404
```

- [ ] **Step 2: Run the new tests to verify they pass**

```bash
just test-api -k "test_move_field"
```

Expected: 2 passed.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add move_field route happy-path and wrong-session tests
```

Then:
```bash
git add apps/api/tests/test_uploads.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 2: Add `trigger_reconcile` edge case tests

**Files:**
- Modify: `apps/api/tests/test_reconciliation_api.py` (append at end of file)

Two paths in `trigger_reconcile` (`apps/api/src/services/upload_service.py`) are untested:
1. **old_only branch** (lines 507–519): when a ref field has no matching upload field, an `old_only` row is created.
2. **fuzzy match path** (lines 475–480): when an upload field key is within edit-distance 3 of a ref field key, they are linked rather than the upload field becoming `new_only`.

Both tests build on existing helpers `_csv` and `_seed_ref_dataset` from `test_reconciliation_api.py`. `_seed_ref_dataset` creates a ref dataset with a single `gender` field.

- [ ] **Step 1: Append the two new tests to `apps/api/tests/test_reconciliation_api.py`**

Add these functions at the end of the file:

```python
async def test_trigger_reconcile_with_ref_only_field_creates_old_only_row(client, db):
    # Ref has "gender"; upload has only "age" — gender is unmatched → old_only row
    col, ref_ds = await _seed_ref_dataset(db)
    csv_bytes = _csv(["age"], [["25"], ["30"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    assert resp.status_code == 201
    sid = resp.json()["id"]

    await client.post(
        f"/api/v1/uploads/{sid}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    rows_resp = await client.get(
        f"/api/v1/uploads/{sid}/reconcile?group=old_only"
    )
    assert rows_resp.status_code == 200
    items = rows_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["ref_field_key"] == "gender"
    assert items[0]["upload_field_id"] is None


async def test_trigger_reconcile_with_near_match_field_key_links_to_ref(client, db):
    # "gende" has edit_distance 1 from "gender" (< 4 threshold) — should link, not be new_only
    col, ref_ds = await _seed_ref_dataset(db)
    csv_bytes = _csv(["gende"], [["male"], ["female"]])
    resp = await client.post(
        "/api/v1/uploads",
        files={"file": ("f.csv", csv_bytes, "text/csv")},
        data={"dataset_name": "Wave 3", "collection_id": str(col.id)},
    )
    assert resp.status_code == 201
    sid = resp.json()["id"]

    await client.post(
        f"/api/v1/uploads/{sid}/reconcile",
        json={"reference_dataset_id": ref_ds.id},
    )
    rows_resp = await client.get(f"/api/v1/uploads/{sid}/reconcile")
    assert rows_resp.status_code == 200
    items = rows_resp.json()["items"]

    gende_rows = [r for r in items if r.get("field_key") == "gende"]
    assert len(gende_rows) == 1
    assert gende_rows[0]["ref_field_key"] == "gender"
    assert gende_rows[0]["group"] != "new_only"
```

- [ ] **Step 2: Run the new tests to verify they pass**

```bash
just test-api -k "test_trigger_reconcile_with"
```

Expected: 2 passed.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add trigger_reconcile old_only branch and fuzzy-match tests
```

Then:
```bash
git add apps/api/tests/test_reconciliation_api.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 3: Rename low-signal test names in test_uploads.py

**Files:**
- Modify: `apps/api/tests/test_uploads.py`

Three test names describe what field is included in the response rather than the condition and guaranteed invariant. Rename them to follow the project convention `test_<thing>_<condition>_<expected_outcome>`.

| Old name | New name |
|----------|----------|
| `test_reconcile_counts` | `test_reconcile_counts_returns_totals_per_group` |
| `test_reconcile_counts_includes_status_counts` | `test_reconcile_counts_with_resolved_rows_includes_status_breakdown` |
| `test_reconcile_counts_includes_blocking_pending` | `test_reconcile_counts_with_pending_rows_returns_blocking_count` |

- [ ] **Step 1: Apply the three renames in `apps/api/tests/test_uploads.py`**

Find and replace:
- `async def test_reconcile_counts(client, db):` → `async def test_reconcile_counts_returns_totals_per_group(client, db):`
- `async def test_reconcile_counts_includes_status_counts(client, db):` → `async def test_reconcile_counts_with_resolved_rows_includes_status_breakdown(client, db):`
- `async def test_reconcile_counts_includes_blocking_pending(client, db):` → `async def test_reconcile_counts_with_pending_rows_returns_blocking_count(client, db):`

- [ ] **Step 2: Run the full uploads test suite to verify nothing broke**

```bash
just test-api -k "test_reconcile_counts"
```

Expected: 3 passed (the renamed tests).

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): rename reconcile_counts tests to follow condition/outcome convention
```

Then:
```bash
git add apps/api/tests/test_uploads.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: Add Step3Reconciliation behavioral tests

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.test.tsx`

`Step3Reconciliation` has two render states (pre-trigger / post-trigger) and several conditional behaviors. No test file exists. Mock only the true external boundary: `@/lib/api`.

The component calls these API methods:
- `api.GET(".../suggested-reference")` on mount
- `api.POST(".../reconcile")` when "Run reconciliation →" is clicked
- `api.GET(".../reconcile/counts")` after trigger
- `api.GET(".../field-tree")` after trigger
- `api.GET(".../reconcile")` (paginated rows) after trigger

- [ ] **Step 1: Create `Step3Reconciliation.test.tsx`**

```typescript
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { WizardState } from "../wizard-types"
import type { ReconRow } from "./ReconciliationRow"
import { Step3Reconciliation } from "./Step3Reconciliation"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)
const mockPost = vi.mocked(api.POST)

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return { step: 3, sessionId: 1, needsReconcile: true, ...overrides }
}

const EMPTY_COUNTS = {
  exact: 0,
  probable: 0,
  new_only: 0,
  old_only: 0,
  blocking_pending: 0,
  status_counts: {},
}

const MOCK_ROW: ReconRow = {
  id: 1,
  group: "probable",
  status: "pending",
  upload_field_id: 10,
  ref_field_id: 20,
  confidence: 0.9,
  note: null,
  field_key: "gende",
  ref_field_key: "gender",
  field_type: "categorical",
}

function mockGetForTriggered(counts = EMPTY_COUNTS, rows: ReconRow[] = []) {
  mockGet.mockImplementation(async (path) => {
    const p = path as string
    if (p.includes("suggested-reference"))
      return { data: { dataset_id: null, dataset_name: null } } as never
    if (p.includes("reconcile/counts"))
      return { data: counts } as never
    if (p.includes("field-tree"))
      return { data: { fields: [], unassigned_fields: [], groups: [] } } as never
    if (p.includes("reconcile"))
      return { data: { items: rows, next_cursor: null } } as never
    return { data: null } as never
  })
  mockPost.mockResolvedValue({ data: { total: rows.length } } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

it("shows suggested reference dataset name fetched on mount", async () => {
  mockGet.mockImplementation(async (path) => {
    if ((path as string).includes("suggested-reference"))
      return { data: { dataset_id: 42, dataset_name: "Wave 2" } } as never
    return { data: null } as never
  })
  render(<Step3Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => expect(screen.getByText("Wave 2")).toBeInTheDocument())
})

it("disables Run button when reference dataset ID is empty", async () => {
  mockGet.mockResolvedValue({ data: { dataset_id: null, dataset_name: null } } as never)
  render(<Step3Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /run reconciliation/i })).toBeDisabled(),
  )
})

it("shows reconciliation tabs after running", async () => {
  const user = userEvent.setup()
  mockGetForTriggered()
  render(<Step3Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /run reconciliation/i }))
  await user.type(screen.getByPlaceholderText("Reference dataset ID"), "10")
  await user.click(screen.getByRole("button", { name: /run reconciliation/i }))
  await waitFor(() => expect(screen.getByRole("button", { name: /exact/i })).toBeInTheDocument())
  expect(screen.getByRole("button", { name: /probable/i })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /new only/i })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /old only/i })).toBeInTheDocument()
})

it("shows bulk action toolbar when a row is selected", async () => {
  const user = userEvent.setup()
  mockGetForTriggered(EMPTY_COUNTS, [MOCK_ROW])
  render(<Step3Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /run reconciliation/i }))
  await user.type(screen.getByPlaceholderText("Reference dataset ID"), "10")
  await user.click(screen.getByRole("button", { name: /run reconciliation/i }))
  await waitFor(() => expect(screen.getByTestId("recon-row")).toBeInTheDocument())
  await user.click(screen.getByRole("checkbox", { name: /select row 1/i }))
  expect(screen.getByText("1 selected")).toBeInTheDocument()
})

it("shows blocking warning and disables Next when blocking_pending > 0", async () => {
  const user = userEvent.setup()
  mockGetForTriggered({ ...EMPTY_COUNTS, blocking_pending: 2 })
  render(<Step3Reconciliation state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => screen.getByRole("button", { name: /run reconciliation/i }))
  await user.type(screen.getByPlaceholderText("Reference dataset ID"), "10")
  await user.click(screen.getByRole("button", { name: /run reconciliation/i }))
  await waitFor(() => expect(screen.getByText(/still need a decision/i)).toBeInTheDocument())
  expect(screen.getByRole("button", { name: /next/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run the new tests**

```bash
just test-web -t "Step3Reconciliation"
```

Expected: 5 passed.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(web): add Step3Reconciliation behavioral tests
```

Then:
```bash
git add apps/web/src/app/datasets/upload/steps/Step3Reconciliation.test.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Task 5: Add Step4MetadataEditor behavioral tests

**Files:**
- Create: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.test.tsx`

`Step4MetadataEditor` has a loading state, a tree/list panel toggle, and a back button that routes to step 3 or step 2 depending on `state.needsReconcile`. No test file exists. Mock only `@/lib/api`.

The component calls:
- `api.GET(".../field-tree")` on mount (loads groups + fields)

- [ ] **Step 1: Create `Step4MetadataEditor.test.tsx`**

```typescript
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, expect, it, vi } from "vitest"
import { api } from "@/lib/api"
import type { WizardState } from "../wizard-types"
import { Step4MetadataEditor } from "./Step4MetadataEditor"

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() },
}))

const mockGet = vi.mocked(api.GET)

const EMPTY_TREE = { fields: [], unassigned_fields: [], groups: [] }

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return { step: 4, sessionId: 1, needsReconcile: true, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
})

it("shows loading text while field tree is fetching", () => {
  mockGet.mockReturnValue(new Promise(() => {}) as never)
  render(<Step4MetadataEditor state={makeState()} setStep={vi.fn()} />)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

it("switches to list panel when List tab is clicked", async () => {
  const user = userEvent.setup()
  mockGet.mockResolvedValue({ data: EMPTY_TREE } as never)
  render(<Step4MetadataEditor state={makeState()} setStep={vi.fn()} />)
  await waitFor(() => expect(screen.getByRole("button", { name: /list/i })).toBeInTheDocument())
  await user.click(screen.getByRole("button", { name: /list/i }))
  expect(screen.getByRole("button", { name: /tree/i })).not.toHaveClass("border-b-2")
})

it("Back navigates to step 3 when needsReconcile is true", async () => {
  const setStep = vi.fn()
  mockGet.mockResolvedValue({ data: EMPTY_TREE } as never)
  render(<Step4MetadataEditor state={makeState({ needsReconcile: true })} setStep={setStep} />)
  await waitFor(() => expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument())
  await userEvent.click(screen.getByRole("button", { name: /back/i }))
  expect(setStep).toHaveBeenCalledWith(3)
})

it("Back navigates to step 2 when needsReconcile is false", async () => {
  const setStep = vi.fn()
  mockGet.mockResolvedValue({ data: EMPTY_TREE } as never)
  render(<Step4MetadataEditor state={makeState({ needsReconcile: false })} setStep={setStep} />)
  await waitFor(() => expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument())
  await userEvent.click(screen.getByRole("button", { name: /back/i }))
  expect(setStep).toHaveBeenCalledWith(2)
})
```

- [ ] **Step 2: Run the new tests**

```bash
just test-web -t "Step4MetadataEditor"
```

Expected: 4 passed.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(web): add Step4MetadataEditor behavioral tests
```

Then:
```bash
git add apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.test.tsx
git commit -F /tmp/commit-msg.txt
```

---

## Self-Review

### Spec coverage
- [x] `move_field` happy path → Task 1 `test_move_field_assigns_to_fieldgroup`
- [x] `move_field` wrong-session 404 → Task 1 `test_move_field_with_wrong_session_returns_404`
- [x] `trigger_reconcile` old_only branch → Task 2 `test_trigger_reconcile_with_ref_only_field_creates_old_only_row`
- [x] `trigger_reconcile` fuzzy match → Task 2 `test_trigger_reconcile_with_near_match_field_key_links_to_ref`
- [x] Three test renames → Task 3
- [x] Step3 pre-trigger ref name → Task 4
- [x] Step3 disabled Run button → Task 4
- [x] Step3 tabs after trigger → Task 4
- [x] Step3 bulk toolbar on select → Task 4
- [x] Step3 blocking pending warning + disabled Next → Task 4
- [x] Step4 loading state → Task 5
- [x] Step4 tree/list toggle → Task 5
- [x] Step4 back to step 3 (needsReconcile=true) → Task 5
- [x] Step4 back to step 2 (needsReconcile=false) → Task 5

### Placeholder scan
No TBDs, no "add appropriate handling", no "similar to Task N". All code blocks are complete.

### Type consistency
- `ReconRow` type imported from `./ReconciliationRow` in Task 4 — matches the interface defined in that file.
- `WizardState` imported from `../wizard-types` — matches the exported interface.
- `FieldMoveOut` response shape (`{ id, upload_fieldgroup_id }`) matches `apps/api/src/models/upload.py:181`.
- `EMPTY_TREE` shape `{ fields, unassigned_fields, groups }` matches `UploadFieldTreeOut`.

### Patterns compliance
- No production code changes — no routes/services to check for response_model or typed returns.
- Frontend tests: no `as any` casts (only `as never` at mock boundaries, which is the documented pattern in `docs/testing.md`).
- Backend tests: no `**kwargs`, no `Any` in signatures — pure pytest async functions.
