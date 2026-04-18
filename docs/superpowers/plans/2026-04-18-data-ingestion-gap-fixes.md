# Data Ingestion Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all ❌ and ⚠️ gaps identified in the functionality audit of Sub-project 6 (Data Ingestion & Metadata Editor), ordered critical-first.

**Architecture:** Most fixes are frontend-only patches to the Next.js wizard. Tasks 2–6 also touch the FastAPI backend to add a `blocking_pending` count field, draft-session list/discard endpoints, and `POST /packages` + `POST /collections` creation routes. No Alembic migrations are needed — all new tables already exist.

**Tech Stack:** FastAPI + SQLModel (async SQLAlchemy), pytest (async, real Postgres), Next.js App Router, vitest, @tanstack/react-virtual, dnd-kit v6.3.1

---

## File Map

### Backend (`apps/api/src/`)
| File | Change |
|---|---|
| `repositories/reconciliation_repo.py` | Add `get_blocking_pending_count()` |
| `routes/uploads.py` | Expose `blocking_pending` in counts; add `GET /uploads` + `DELETE /uploads/{id}` |
| `repositories/package_repo.py` | Add `create_package()` |
| `routes/packages.py` | Add `POST /packages` |
| `routes/collections.py` | Add `POST /collections` |

### Frontend (`apps/web/src/app/datasets/`)
| File | Change |
|---|---|
| `upload/useWizardState.ts` | Persist `needsReconcile` to URL param `reconcile=1` |
| `upload/steps/Step3Reconciliation.tsx` | Use `blocking_pending` for Next gate; add page-size selector |
| `DatasetsPage.tsx` | Show draft sessions with Resume / Discard actions |
| `upload/steps/Step1FileHierarchy.tsx` | Show row count after upload; inline new package/collection creation; skip reconcile for new collections |
| `upload/steps/FieldEditorPanel.tsx` | Delete-field confirmation; Add level button; levels raw-value column + inherited badge; + New group button |
| `upload/steps/FieldTree.tsx` | Group ⋮ menu: Add subgroup + Move to… |
| `upload/steps/Step5ReviewCommit.tsx` | Reconciliation summary colored chips; group field counts |

### Tests
| File | Change |
|---|---|
| `apps/api/tests/test_uploads.py` | Tests for `GET /uploads`, `DELETE /uploads/{id}`, `blocking_pending` |
| `apps/api/tests/test_packages.py` | Test for `POST /packages` |
| `apps/api/tests/test_collections.py` | Test for `POST /collections` |

---

## Task 1: Persist `needsReconcile` to URL

**Files:**
- Modify: `apps/web/src/app/datasets/upload/useWizardState.ts`

- [ ] **Step 1: Update `setNeedsReconcile` to write `reconcile=1` to URL**

  Replace the current `setNeedsReconcile` callback (lines 37–39):

  ```typescript
  const setNeedsReconcile = useCallback(
    (v: boolean) => {
      setState((prev) => ({ ...prev, needsReconcile: v }))
      const p = new URLSearchParams(params.toString())
      if (v) {
        p.set("reconcile", "1")
      } else {
        p.delete("reconcile")
      }
      router.replace(`/datasets/upload?${p.toString()}`)
    },
    [params, router],
  )
  ```

- [ ] **Step 2: Verify manually** — start the wizard, upload a CSV into an existing collection, then refresh the browser on Step 2. Confirm `reconcile=1` is in the URL and `state.needsReconcile` is `true` on the refreshed page.

- [ ] **Step 3: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  fix(web): persist needsReconcile flag to URL query param
  ```
  Then: `git add apps/web/src/app/datasets/upload/useWizardState.ts && git commit -F /tmp/commit-msg.txt`

---

## Task 2: Server-side blocking pending count for Step 3 gate

**Files:**
- Modify: `apps/api/src/repositories/reconciliation_repo.py`
- Modify: `apps/api/src/routes/uploads.py`
- Modify: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`
- Test: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Write failing test for `blocking_pending` in counts response**

  Append to `apps/api/tests/test_uploads.py`:

  ```python
  async def test_reconcile_counts_includes_blocking_pending(client, db):
      """blocking_pending = count of probable+old_only rows with status pending."""
      pkg = Package(name="P"); db.add(pkg); await db.flush(); await db.refresh(pkg)
      col = Collection(name="C", package_id=pkg.id, collection_type=CollectionType.primary)
      db.add(col); await db.flush(); await db.refresh(col)

      csv_bytes = _make_csv(["id", "q1"], [["1", "a"], ["2", "b"]])
      r = await client.post(
          "/api/v1/uploads",
          files={"file": ("f.csv", csv_bytes, "text/csv")},
          data={"dataset_name": "D", "collection_id": str(col.id)},
      )
      session_id = r.json()["id"]

      # Create a committed dataset to reconcile against
      from src.models.dataset import Dataset
      from src.models.field import Field, FieldType
      ds = Dataset(name="Ref", collection_id=col.id, collected_at=None)
      db.add(ds); await db.flush(); await db.refresh(ds)
      ref_field = Field(dataset_id=ds.id, field_key="q1", field_type=FieldType.categorical, sort_order=0)
      db.add(ref_field); await db.flush()
      await db.commit()

      await client.post(
          f"/api/v1/uploads/{session_id}/reconcile",
          json={"reference_dataset_id": ds.id},
      )

      r2 = await client.get(f"/api/v1/uploads/{session_id}/reconcile/counts")
      assert r2.status_code == 200
      data = r2.json()
      assert "blocking_pending" in data
      assert isinstance(data["blocking_pending"], int)
  ```

- [ ] **Step 2: Run test to confirm failure**

  ```
  just test-api -k test_reconcile_counts_includes_blocking_pending
  ```
  Expected: FAIL — `KeyError: 'blocking_pending'`

- [ ] **Step 3: Add `get_blocking_pending_count()` to reconciliation repo**

  Append to `apps/api/src/repositories/reconciliation_repo.py`:

  ```python
  async def get_blocking_pending_count(
      session: AsyncSession,
      upload_session_id: int,
  ) -> int:
      """Count probable + old_only rows whose status is still pending."""
      result = await session.execute(
          select(func.count(ReconciliationRow.id)).where(
              ReconciliationRow.upload_session_id == upload_session_id,
              ReconciliationRow.status == ReconciliationStatus.pending,
              ReconciliationRow.group.in_(
                  [ReconciliationGroup.probable, ReconciliationGroup.old_only]
              ),
          )
      )
      return result.scalar_one()
  ```

- [ ] **Step 4: Expose `blocking_pending` in the counts route**

  In `apps/api/src/routes/uploads.py`, update `get_reconcile_counts` (line ~314):

  ```python
  @router.get("/uploads/{session_id}/reconcile/counts")
  async def get_reconcile_counts(session_id: int, session: AsyncSession = Depends(get_session)):
      group_counts = await reconciliation_repo.get_counts_by_group(session, session_id)
      status_counts = await reconciliation_repo.get_status_counts(session, session_id)
      blocking_pending = await reconciliation_repo.get_blocking_pending_count(session, session_id)
      return {**group_counts, "status_counts": status_counts, "blocking_pending": blocking_pending}
  ```

- [ ] **Step 5: Run test to confirm it passes**

  ```
  just test-api -k test_reconcile_counts_includes_blocking_pending
  ```
  Expected: PASS

- [ ] **Step 6: Update Step 3 frontend to use `blocking_pending` from server**

  In `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`:

  Add `blockingPending` to state (replace `pendingCount` derivation):

  ```typescript
  const [blockingPending, setBlockingPending] = useState(0)
  ```

  Update `fetchCounts()`:

  ```typescript
  async function fetchCounts() {
    if (!state.sessionId) return
    const data = await fetch(
      `${API_BASE}/api/v1/uploads/${state.sessionId}/reconcile/counts`,
    ).then((r) => r.json())
    setCounts(data)
    setBlockingPending(data.blocking_pending ?? 0)
  }
  ```

  Delete the local `pendingCount` derivation (the `.filter(...)` line) and replace all references to `pendingCount` with `blockingPending`.

- [ ] **Step 7: Regenerate shared types**

  ```
  just generate-types
  ```

- [ ] **Step 8: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  fix(api,web): use server-side blocking_pending count for Step 3 Next gate
  ```
  Then:
  ```
  git add apps/api/src/repositories/reconciliation_repo.py apps/api/src/routes/uploads.py apps/api/tests/test_uploads.py apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx packages/shared/api.d.ts
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 3: Draft sessions in backend — list and discard endpoints

**Files:**
- Modify: `apps/api/src/repositories/upload_repo.py`
- Modify: `apps/api/src/routes/uploads.py`
- Test: `apps/api/tests/test_uploads.py`

- [ ] **Step 1: Write failing tests**

  Append to `apps/api/tests/test_uploads.py`:

  ```python
  async def test_list_uploads_returns_non_committed_sessions(client, db):
      csv_bytes = _make_csv(["id"], [["1"]])
      r = await client.post(
          "/api/v1/uploads",
          files={"file": ("f.csv", csv_bytes, "text/csv")},
          data={"dataset_name": "My Draft"},
      )
      assert r.status_code == 201

      r2 = await client.get("/api/v1/uploads")
      assert r2.status_code == 200
      items = r2.json()["items"]
      assert any(i["dataset_name"] == "My Draft" for i in items)
      assert all(i["status"] != "committed" for i in items)


  async def test_discard_upload_session(client, db):
      csv_bytes = _make_csv(["id"], [["1"]])
      r = await client.post(
          "/api/v1/uploads",
          files={"file": ("f.csv", csv_bytes, "text/csv")},
          data={"dataset_name": "ToDiscard"},
      )
      session_id = r.json()["id"]

      r2 = await client.delete(f"/api/v1/uploads/{session_id}")
      assert r2.status_code == 204

      # Session should not appear in list
      r3 = await client.get("/api/v1/uploads")
      items = r3.json()["items"]
      assert not any(i["id"] == session_id for i in items)
  ```

- [ ] **Step 2: Run tests to confirm failure**

  ```
  just test-api -k "test_list_uploads or test_discard_upload"
  ```
  Expected: FAIL — 404 / 405

- [ ] **Step 3: Add `list_draft_sessions()` to upload repo**

  Append to `apps/api/src/repositories/upload_repo.py`:

  ```python
  async def list_draft_sessions(session: AsyncSession) -> list[UploadSession]:
      """Return all sessions that are not committed or abandoned."""
      result = await session.execute(
          select(UploadSession)
          .where(
              UploadSession.status.not_in(
                  [UploadSessionStatus.committed, UploadSessionStatus.abandoned]
              )
          )
          .order_by(UploadSession.created_at.desc())
      )
      return list(result.scalars().all())


  async def discard_session(session: AsyncSession, session_id: int) -> bool:
      """Set status to abandoned. Returns False if session not found."""
      sess = await get_session_by_id(session, session_id)
      if sess is None:
          return False
      sess.status = UploadSessionStatus.abandoned
      session.add(sess)
      await session.flush()
      return True
  ```

- [ ] **Step 4: Add `GET /uploads` and `DELETE /uploads/{id}` routes**

  In `apps/api/src/routes/uploads.py`, add these two routes **before** `GET /uploads/{session_id}` (i.e., before line 45) so FastAPI resolves them correctly:

  ```python
  @router.get("/uploads")
  async def list_upload_sessions(session: AsyncSession = Depends(get_session)):
      """List all non-committed, non-abandoned upload sessions (drafts)."""
      sessions = await upload_repo.list_draft_sessions(session)
      items = []
      for sess in sessions:
          meta: dict = {}
          if sess.collection_id:
              meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
          items.append({
              "id": sess.id,
              "status": sess.status.value,
              "dataset_name": sess.dataset_name,
              "collection_name": meta.get("collection_name"),
              "package_name": meta.get("package_name"),
              "collected_at": sess.collected_at.isoformat() if sess.collected_at else None,
              "created_at": sess.created_at.isoformat(),
          })
      return {"items": items}


  @router.delete("/uploads/{session_id}", status_code=204)
  async def discard_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
      """Mark an upload session as abandoned (soft delete)."""
      discarded = await upload_repo.discard_session(session, session_id)
      if not discarded:
          raise HTTPException(status_code=404, detail="Upload session not found")
  ```

  **Important:** The `UploadSession` model must have `created_at`. Verify this in `apps/api/src/models/upload.py` — if missing, add `created_at: datetime = Field(default_factory=datetime.utcnow)`.

- [ ] **Step 5: Run tests to confirm they pass**

  ```
  just test-api -k "test_list_uploads or test_discard_upload"
  ```
  Expected: PASS

- [ ] **Step 6: Regenerate types**

  ```
  just generate-types
  ```

- [ ] **Step 7: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add GET /uploads (draft list) and DELETE /uploads/{id} (discard)
  ```
  Then:
  ```
  git add apps/api/src/repositories/upload_repo.py apps/api/src/routes/uploads.py apps/api/tests/test_uploads.py packages/shared/api.d.ts
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 4: Draft sessions on `/datasets` page — frontend

**Files:**
- Modify: `apps/web/src/app/datasets/DatasetsPage.tsx`

- [ ] **Step 1: Add draft sessions state and fetch**

  In `DatasetsPage.tsx`, add state and fetch alongside the committed datasets fetch. Add `DraftItem` type at the top:

  ```typescript
  type DraftItem = {
    id: number
    status: string
    dataset_name: string | null
    collection_name: string | null
    package_name: string | null
    created_at: string
  }
  ```

  Add state inside the component:

  ```typescript
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  ```

  Add a `useEffect` to fetch drafts (alongside the existing committed datasets fetch):

  ```typescript
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
    fetch(`${base}/api/v1/uploads`)
      .then((r) => r.json())
      .then((data) => setDrafts(data.items ?? []))
  }, [])
  ```

- [ ] **Step 2: Add step derivation helper**

  Add a helper that maps session status to the wizard step URL for resuming:

  ```typescript
  function resumeUrl(draft: DraftItem): string {
    const stepMap: Record<string, number> = {
      pending: 2,
      detecting: 2,
      reconciling: 3,
      editing: 4,
    }
    const step = stepMap[draft.status] ?? 2
    const reconcile = draft.status === "reconciling" || draft.status === "editing" ? "&reconcile=1" : ""
    return `/datasets/upload?session=${draft.id}&step=${step}${reconcile}`
  }
  ```

- [ ] **Step 3: Render drafts section above the committed table**

  Inside the `return` block, add this immediately after the filter bar `</div>` and before the `{loading ? ... }` block:

  ```tsx
  {drafts.length > 0 && (
    <div className="mb-6">
      <h2 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
        In progress
      </h2>
      <div className="space-y-2">
        {drafts.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-700 dark:bg-amber-950/30"
            data-testid="draft-session-row"
          >
            <div>
              <span className="font-semibold text-foreground">
                {d.dataset_name ?? "Untitled upload"}
              </span>
              {d.collection_name && (
                <span className="ml-2 text-muted-foreground text-xs">
                  {d.package_name} › {d.collection_name}
                </span>
              )}
              <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 font-semibold text-amber-800 text-xs dark:bg-amber-800 dark:text-amber-200">
                draft
              </span>
            </div>
            <div className="flex gap-3">
              <Link
                href={resumeUrl(d)}
                className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-sm text-white hover:opacity-90"
              >
                Resume →
              </Link>
              <button
                type="button"
                onClick={async () => {
                  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
                  await fetch(`${base}/api/v1/uploads/${d.id}`, { method: "DELETE" })
                  setDrafts((prev) => prev.filter((x) => x.id !== d.id))
                }}
                className="font-semibold text-destructive text-xs hover:underline"
              >
                Discard
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
  ```

- [ ] **Step 4: Verify in browser**

  Navigate to `http://localhost:3000/datasets/upload`, upload a CSV (don't commit), then navigate to `http://localhost:3000/datasets`. Confirm the draft appears in the "In progress" section with "Resume →" and "Discard" buttons.

  Click "Resume →" and confirm the wizard opens at the correct step with the session ID in the URL.

  Click "Discard" and confirm the draft disappears.

- [ ] **Step 5: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): show draft upload sessions on /datasets with resume and discard
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/DatasetsPage.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 5: New package/collection creation — backend

**Files:**
- Modify: `apps/api/src/repositories/package_repo.py`
- Modify: `apps/api/src/routes/packages.py`
- Modify: `apps/api/src/routes/collections.py`
- Test: `apps/api/tests/test_packages.py`
- Test: `apps/api/tests/test_collections.py`

- [ ] **Step 1: Write failing tests**

  Append to `apps/api/tests/test_packages.py`:

  ```python
  async def test_create_package(client, db):
      r = await client.post("/api/v1/packages", json={"name": "Brand Tracker"})
      assert r.status_code == 201
      data = r.json()
      assert data["name"] == "Brand Tracker"
      assert "id" in data
  ```

  Append to `apps/api/tests/test_collections.py`:

  ```python
  async def test_create_collection(client, db):
      from src.models.package import Package
      pkg = Package(name="P"); db.add(pkg); await db.flush(); await db.refresh(pkg)
      await db.commit()

      r = await client.post(
          "/api/v1/collections",
          json={"name": "Wave Series", "package_id": pkg.id},
      )
      assert r.status_code == 201
      data = r.json()
      assert data["name"] == "Wave Series"
      assert data["package_id"] == pkg.id
      assert "id" in data
  ```

- [ ] **Step 2: Run tests to confirm failure**

  ```
  just test-api -k "test_create_package or test_create_collection"
  ```
  Expected: FAIL — 405 Method Not Allowed

- [ ] **Step 3: Add `create_package()` to package repo**

  Append to `apps/api/src/repositories/package_repo.py`:

  ```python
  async def create_package(session: AsyncSession, name: str) -> Package:
      pkg = Package(name=name)
      session.add(pkg)
      await session.flush()
      await session.refresh(pkg)
      return pkg
  ```

- [ ] **Step 4: Add `POST /packages` route**

  In `apps/api/src/routes/packages.py`, add after the existing imports:

  ```python
  from pydantic import BaseModel
  from src.repositories import package_repo as _pkg_repo

  class PackageCreate(BaseModel):
      name: str

  @router.post("/packages", status_code=201)
  async def create_package(body: PackageCreate, session: AsyncSession = Depends(get_session)):
      """Create a new package."""
      pkg = await _pkg_repo.create_package(session, body.name)
      return {"id": pkg.id, "name": pkg.name}
  ```

  (The `AsyncSession` import and `Depends` are already in the file — verify before adding.)

- [ ] **Step 5: Add `create_collection()` to a collection repo**

  Check whether `apps/api/src/repositories/collection_repo.py` exists. If not, create it. Add:

  ```python
  from sqlalchemy.ext.asyncio import AsyncSession
  from src.models.collection import Collection, CollectionType


  async def create_collection(
      session: AsyncSession, name: str, package_id: int
  ) -> Collection:
      col = Collection(name=name, package_id=package_id, collection_type=CollectionType.primary)
      session.add(col)
      await session.flush()
      await session.refresh(col)
      return col
  ```

- [ ] **Step 6: Add `POST /collections` route**

  In `apps/api/src/routes/collections.py`, add:

  ```python
  from pydantic import BaseModel
  from sqlalchemy.ext.asyncio import AsyncSession
  from fastapi import Depends
  from src.database import get_session
  from src.repositories import collection_repo

  class CollectionCreate(BaseModel):
      name: str
      package_id: int

  @router.post("/collections", status_code=201)
  async def create_collection(body: CollectionCreate, session: AsyncSession = Depends(get_session)):
      """Create a new collection within a package."""
      col = await collection_repo.create_collection(session, body.name, body.package_id)
      return {"id": col.id, "name": col.name, "package_id": col.package_id}
  ```

  Then register `collection_repo` import at top of file. Verify `collections.py` is already registered in `apps/api/src/main.py` — if not, add it.

- [ ] **Step 7: Run tests to confirm they pass**

  ```
  just test-api -k "test_create_package or test_create_collection"
  ```
  Expected: PASS

- [ ] **Step 8: Regenerate types**

  ```
  just generate-types
  ```

- [ ] **Step 9: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add POST /packages and POST /collections creation endpoints
  ```
  Then:
  ```
  git add apps/api/src/repositories/package_repo.py apps/api/src/routes/packages.py apps/api/src/routes/collections.py apps/api/tests/test_packages.py apps/api/tests/test_collections.py packages/shared/api.d.ts
  git commit -F /tmp/commit-msg.txt
  ```
  (Add `apps/api/src/repositories/collection_repo.py` if it was created.)

---

## Task 6: Inline new package/collection in Step 1 + skip-reconcile for new collections

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`

This task replaces the plain package/collection `<select>` dropdowns with a combo that either picks an existing item or lets the user create a new one inline.

- [ ] **Step 1: Add `creatingPackage`, `creatingCollection`, and `newPackageName`/`newCollectionName` state**

  Add these state variables inside `Step1FileHierarchy`:

  ```typescript
  const [creatingPackage, setCreatingPackage] = useState(false)
  const [newPackageName, setNewPackageName] = useState("")
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [isNewCollection, setIsNewCollection] = useState(false)
  ```

- [ ] **Step 2: Update `canProceed` to handle create-mode**

  ```typescript
  const canProceed =
    file !== null &&
    datasetName.trim().length > 0 &&
    collectedAt !== "" &&
    (
      (creatingPackage && newPackageName.trim().length > 0 && creatingCollection && newCollectionName.trim().length > 0)
      || (!creatingPackage && selectedPackageId !== "" && (
        (creatingCollection && newCollectionName.trim().length > 0)
        || (!creatingCollection && selectedCollectionId !== "")
      ))
    )
  ```

- [ ] **Step 3: Replace the package `<select>` with a combo**

  Replace the package selector `<div>` block:

  ```tsx
  <div>
    <label className="mb-1 block font-semibold text-muted-foreground text-xs" htmlFor="pkg-select">
      Package *
    </label>
    {creatingPackage ? (
      <div className="flex gap-2">
        <input
          autoFocus
          value={newPackageName}
          onChange={(e) => setNewPackageName(e.target.value)}
          placeholder="New package name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => { setCreatingPackage(false); setNewPackageName("") }}
          className="rounded-md border border-border px-3 py-2 text-muted-foreground text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    ) : (
      <div className="flex gap-2">
        <select
          id="pkg-select"
          value={selectedPackageId}
          onChange={(e) => setSelectedPackageId(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Select package…</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setCreatingPackage(true); setSelectedPackageId(""); setCollections([]); setSelectedCollectionId("") }}
          className="rounded-md border border-border px-3 py-2 font-semibold text-accent text-sm hover:bg-muted"
        >
          + New
        </button>
      </div>
    )}
  </div>
  ```

- [ ] **Step 4: Replace the collection `<select>` with a combo**

  Replace the collection selector `<div>` block:

  ```tsx
  <div>
    <label className="mb-1 block font-semibold text-muted-foreground text-xs" htmlFor="col-select">
      Collection *
    </label>
    {creatingCollection ? (
      <div className="flex gap-2">
        <input
          autoFocus
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          placeholder="New collection name"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => { setCreatingCollection(false); setNewCollectionName(""); setIsNewCollection(false) }}
          className="rounded-md border border-border px-3 py-2 text-muted-foreground text-sm hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    ) : (
      <div className="flex gap-2">
        <select
          id="col-select"
          value={selectedCollectionId}
          onChange={(e) => setSelectedCollectionId(e.target.value)}
          disabled={!selectedPackageId && !creatingPackage}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-40"
        >
          <option value="">Select collection…</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedPackageId && !creatingPackage}
          onClick={() => { setCreatingCollection(true); setSelectedCollectionId(""); setIsNewCollection(true) }}
          className="rounded-md border border-border px-3 py-2 font-semibold text-accent text-sm hover:bg-muted disabled:opacity-40"
        >
          + New
        </button>
      </div>
    )}
  </div>
  ```

- [ ] **Step 5: Update `handleNext` to create package/collection before uploading, and set `needsReconcile` correctly**

  Replace `handleNext`:

  ```typescript
  async function handleNext() {
    if (!file || !canProceed) return
    setBusy(true)
    setError(null)
    const base = API_BASE
    try {
      // 1. Resolve package ID
      let pkgId = selectedPackageId
      if (creatingPackage) {
        const r = await fetch(`${base}/api/v1/packages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newPackageName.trim() }),
        })
        if (!r.ok) throw new Error("Failed to create package")
        const pkg = await r.json()
        pkgId = String(pkg.id)
        setPackages((prev) => [...prev, pkg])
        setSelectedPackageId(pkgId)
      }

      // 2. Resolve collection ID
      let colId = selectedCollectionId
      if (creatingCollection) {
        const r = await fetch(`${base}/api/v1/collections`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCollectionName.trim(), package_id: Number(pkgId) }),
        })
        if (!r.ok) throw new Error("Failed to create collection")
        const col = await r.json()
        colId = String(col.id)
      }

      // 3. Upload file
      const form = new FormData()
      form.append("file", file)
      form.append("dataset_name", datasetName)
      form.append("collection_id", colId)
      form.append("collected_at", `${collectedAt}-01`)
      const res = await fetch(`${base}/api/v1/uploads`, { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      setSessionId(data.id)
      // Skip reconciliation only for brand-new collections
      setNeedsReconcile(!isNewCollection)
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
    }
  }
  ```

- [ ] **Step 6: Verify in browser**

  - Upload a CSV into an existing collection → confirm Step 3 appears in the progress bar (not struck through).
  - Upload a CSV using "+ New package" and "+ New collection" → confirm Step 3 is struck through in the progress bar and Step 2 → Next goes directly to Step 4.

- [ ] **Step 7: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): inline new package/collection creation in Step 1; skip reconcile for new collections
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 7: Step 3 page-size selector

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx`

- [ ] **Step 1: Add `pageSize` state and selector UI**

  Replace the `const PAGE_SIZE = 50` constant with a state variable:

  ```typescript
  const [pageSize, setPageSize] = useState(50)
  ```

  In `fetchPage`, replace `String(PAGE_SIZE)` with `String(pageSize)`:

  ```typescript
  const params = new URLSearchParams({ page_size: String(pageSize), group: activeTab })
  ```

  Add a `useEffect` to re-fetch when `pageSize` changes (alongside the existing tab-change effect):

  ```typescript
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchPage intentionally excluded
  useEffect(() => {
    if (triggered) {
      setRows([])
      setSelected(new Set())
      fetchPage(null)
    }
  }, [activeTab, triggered, pageSize])
  ```

  In the pagination controls `<div>`, add a page-size `<select>` before the "Load more" button:

  ```tsx
  <select
    value={pageSize}
    onChange={(e) => setPageSize(Number(e.target.value))}
    className="rounded border border-border bg-background px-2 py-0.5 text-foreground text-xs"
    aria-label="Page size"
  >
    <option value={25}>25 / page</option>
    <option value={50}>50 / page</option>
    <option value={100}>100 / page</option>
  </select>
  ```

- [ ] **Step 2: Verify in browser** — trigger reconciliation on a session with rows, confirm changing the page-size selector reloads the rows.

- [ ] **Step 3: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): add page-size selector (25/50/100) to Step 3 reconciliation
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/Step3Reconciliation.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 8: Delete-field confirmation dialog

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`

- [ ] **Step 1: Add `confirmingDelete` state and confirmation UI**

  Add state:

  ```typescript
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  ```

  Replace the Delete button in the footer:

  ```tsx
  {confirmingDelete ? (
    <div className="flex gap-2">
      <span className="text-destructive text-xs self-center">Delete this field?</span>
      <button
        type="button"
        onClick={() => { void onDelete(); setConfirmingDelete(false) }}
        className="rounded bg-destructive px-3 py-1.5 font-semibold text-sm text-white hover:opacity-90"
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirmingDelete(false)}
        className="rounded border border-border px-3 py-1.5 text-muted-foreground text-sm hover:bg-muted"
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setConfirmingDelete(true)}
      className="rounded border border-destructive px-4 py-1.5 text-destructive text-sm hover:bg-destructive/10"
    >
      Delete
    </button>
  )}
  ```

  Reset `confirmingDelete` when the selected field changes — add to the `useEffect` on `field`:

  ```typescript
  useEffect(() => {
    if (!field) return
    setDisplayName(field.display_name ?? "")
    setOverrideType(field.override_type ?? "")
    setGroupId(field.upload_fieldgroup_id ? String(field.upload_fieldgroup_id) : "")
    setSortOrder(field.sort_order)
    setLevels(field.levels ?? [])
    setConfirmingDelete(false)  // ← add this line
  }, [field])
  ```

- [ ] **Step 2: Verify in browser** — select a field, click Delete, confirm the inline "Delete this field?" confirmation appears, then confirm deletion completes.

- [ ] **Step 3: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  fix(web): require confirmation before deleting a field in metadata editor
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 9: "Add level" button in FieldEditorPanel

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`

- [ ] **Step 1: Add `newLevelValue` state**

  ```typescript
  const [newLevelValue, setNewLevelValue] = useState("")
  ```

- [ ] **Step 2: Add the "Add level" row below the levels list**

  Inside the `showLevels` block, after the closing `</div>` of the levels list, add:

  ```tsx
  <div className="flex gap-1 pt-1">
    <input
      type="text"
      value={newLevelValue}
      onChange={(e) => setNewLevelValue(e.target.value)}
      placeholder="New raw value…"
      className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          addLevel()
        }
      }}
    />
    <button
      type="button"
      onClick={addLevel}
      disabled={!newLevelValue.trim()}
      className="rounded bg-muted px-2 py-0.5 font-semibold text-xs hover:bg-muted/80 disabled:opacity-40"
    >
      + Add
    </button>
  </div>
  ```

- [ ] **Step 3: Implement `addLevel` function**

  Add before `handleSave`:

  ```typescript
  function addLevel() {
    const raw = newLevelValue.trim()
    if (!raw) return
    if (levels.some((l) => l.raw_value === raw)) return  // no duplicates
    setLevels((prev) => [
      ...prev,
      {
        id: -Date.now(),  // temp negative ID; upsert-by-raw-value on save
        raw_value: raw,
        display_label: null,
        sort_order: prev.length,
        is_inherited: false,
      },
    ])
    setNewLevelValue("")
  }
  ```

- [ ] **Step 4: Guard save loop against temp IDs and empty raw values**

  In `handleSave`, the levels loop already calls `PUT /levels` with `raw_value` (not id), so temp negative IDs are fine. However, ensure we skip levels with empty `raw_value`. Update the loop:

  ```typescript
  for (const lvl of levels) {
    if (!lvl.raw_value.trim()) continue  // skip blank new levels
    await fetch(`${API_BASE}/api/v1/uploads/${sessionId}/fields/${field.id}/levels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_value: lvl.raw_value,
        display_label: lvl.display_label,
        sort_order: lvl.sort_order,
      }),
    })
  }
  ```

  Also reset `newLevelValue` at the end of `handleSave`:

  ```typescript
  setNewLevelValue("")
  ```

- [ ] **Step 5: Verify in browser** — select a categorical/ordinal field, type a raw value, click "+ Add", confirm the new level appears in the list and persists after Save.

- [ ] **Step 6: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): add "Add level" button to field editor levels panel
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 10: Group ⋮ context menu — Add subgroup + Move to…

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldTree.tsx`

The `GroupContextMenu` component currently has only "Rename" and "Delete". This task adds "Add subgroup" and "Move to…" (a flat list of other groups to re-parent to).

- [ ] **Step 1: Add `onAddSubgroup` and `onMoveTo` props to `GroupContextMenu`**

  Update the interface:

  ```typescript
  function GroupContextMenu({
    groupId,
    groupName,
    groups,
    onRename,
    onDelete,
    onAddSubgroup,
    onMoveTo,
    onClose,
  }: {
    groupId: number
    groupName: string
    groups: GroupNode[]
    onRename: (id: number, name: string) => void
    onDelete: (id: number) => void
    onAddSubgroup: (parentId: number) => void
    onMoveTo: (groupId: number, newParentId: number | null) => void
    onClose: () => void
  })
  ```

- [ ] **Step 2: Add the new menu items to `GroupContextMenu`**

  In the menu `<div>` (when not renaming), add after the Rename button and before Delete:

  ```tsx
  <button
    type="button"
    onClick={() => { onAddSubgroup(groupId); onClose() }}
    className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
  >
    + Add subgroup
  </button>
  <div className="border-border border-t my-0.5" />
  <div className="px-3 py-1 font-semibold text-muted-foreground text-xs">Move to…</div>
  <button
    type="button"
    onClick={() => { onMoveTo(groupId, null); onClose() }}
    className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
  >
    — Top level
  </button>
  {groups
    .filter((g) => g.id !== groupId && g.parent_id !== groupId)
    .map((g) => (
      <button
        key={g.id}
        type="button"
        onClick={() => { onMoveTo(groupId, g.id); onClose() }}
        className="flex w-full items-center px-3 py-1.5 text-xs hover:bg-muted"
      >
        {g.name}
      </button>
    ))}
  ```

- [ ] **Step 3: Update `renderGroup` to pass the new props**

  In the `renderGroup` function, `GroupContextMenu` is rendered with:

  ```tsx
  {openMenuId === group.id && (
    <GroupContextMenu
      groupId={group.id}
      groupName={group.name}
      groups={groups}
      onRename={(id, name) => onRenameGroup?.(id, name)}
      onDelete={onDeleteGroup}
      onAddSubgroup={(parentId) => onCreateGroup("New subgroup", parentId)}
      onMoveTo={async (gId, newParentId) => {
        // Call PATCH /fieldgroups/{id} with parent_id
        // onMoveGroup prop needs to be threaded through from Step4MetadataEditor
        await onMoveGroup?.(gId, newParentId)
      }}
      onClose={() => setOpenMenuId(null)}
    />
  )}
  ```

- [ ] **Step 4: Add `onMoveGroup` prop to `FieldTree` and wire it in `Step4MetadataEditor`**

  Add to `FieldTree` Props interface:

  ```typescript
  onMoveGroup?: (groupId: number, newParentId: number | null) => Promise<void>
  ```

  In `Step4MetadataEditor.tsx`, pass the handler:

  ```tsx
  <FieldTree
    ...
    onMoveGroup={async (groupId, newParentId) => {
      if (!state.sessionId) return
      await fetch(
        `${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups/${groupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: newParentId }),
        },
      )
      await loadTree()
    }}
  />
  ```

- [ ] **Step 5: Verify in browser** — open Step 4, create two groups, open the ⋮ menu on one group and confirm "Add subgroup" and "Move to…" with the other group appear. Test that moving a group to another re-parents it in the tree.

- [ ] **Step 6: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): add "Add subgroup" and "Move to…" to group context menu in tree view
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/FieldTree.tsx apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 11: Levels editor — inherited badge + raw-value column

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`

- [ ] **Step 1: Replace the current levels row with a 3-column layout**

  Replace each level row inside `levels.map(...)`:

  ```tsx
  {levels.map((lvl, i) => (
    <div key={lvl.id} className="flex items-center gap-2 py-0.5">
      <span className="w-24 shrink-0 font-mono text-muted-foreground text-xs truncate" title={lvl.raw_value}>
        {lvl.raw_value}
      </span>
      <input
        type="text"
        value={lvl.display_label ?? ""}
        onChange={(e) =>
          setLevels((prev) =>
            prev.map((l, j) => (j === i ? { ...l, display_label: e.target.value || null } : l)),
          )
        }
        placeholder="Display label…"
        className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
      />
      {lvl.is_inherited ? (
        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700 text-xs dark:bg-blue-900/30 dark:text-blue-300">
          inherited
        </span>
      ) : lvl.id > 0 ? (
        <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 font-semibold text-green-700 text-xs dark:bg-green-900/30 dark:text-green-300">
          existing
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-semibold text-muted-foreground text-xs">
          new
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          if (lvl.id > 0) {
            void handleDeleteLevel(lvl.id)
          } else {
            setLevels((prev) => prev.filter((_, j) => j !== i))
          }
        }}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Remove level ${lvl.raw_value}`}
      >
        ×
      </button>
    </div>
  ))}
  ```

  (New levels with `id < 0` are deleted from local state only; existing levels call `handleDeleteLevel`.)

- [ ] **Step 2: Verify in browser** — open a categorical field with levels, confirm raw values appear as a read-only monospace column, inherited flag shows "inherited" badge, and new levels show "new" badge.

- [ ] **Step 3: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): show raw-value column and inherited/new badges in levels editor
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 12: Group field counts in Step 5 — backend

**Files:**
- Modify: `apps/api/src/routes/uploads.py`
- Test: `apps/api/tests/test_field_tree.py`

- [ ] **Step 1: Write failing test**

  Append to `apps/api/tests/test_field_tree.py`:

  ```python
  async def test_field_tree_groups_include_field_count(client, db):
      """Each group in the field-tree response should include field_count."""
      from src.models.collection import Collection, CollectionType
      from src.models.package import Package
      pkg = Package(name="P"); db.add(pkg); await db.flush(); await db.refresh(pkg)
      col = Collection(name="C", package_id=pkg.id, collection_type=CollectionType.primary)
      db.add(col); await db.flush(); await db.refresh(col)
      await db.commit()

      csv_bytes = _make_csv(["id", "q1", "q2"], [["1", "a", "x"]])
      r = await client.post(
          "/api/v1/uploads",
          files={"file": ("f.csv", csv_bytes, "text/csv")},
          data={"dataset_name": "D", "collection_id": str(col.id)},
      )
      session_id = r.json()["id"]

      # Create a group and move a field into it
      rg = await client.post(
          f"/api/v1/uploads/{session_id}/fieldgroups",
          json={"name": "Demographics"},
      )
      group_id = rg.json()["id"]
      fields_r = await client.get(f"/api/v1/uploads/{session_id}")
      field_id = fields_r.json()["fields"][0]["id"]
      await client.patch(
          f"/api/v1/uploads/{session_id}/fields/{field_id}/move",
          json={"upload_fieldgroup_id": group_id},
      )

      tree_r = await client.get(f"/api/v1/uploads/{session_id}/field-tree")
      assert tree_r.status_code == 200
      groups = tree_r.json()["groups"]
      assert any("field_count" in g for g in groups)
      demo = next(g for g in groups if g["name"] == "Demographics")
      assert demo["field_count"] == 1
  ```

- [ ] **Step 2: Run test to confirm failure**

  ```
  just test-api -k test_field_tree_groups_include_field_count
  ```
  Expected: FAIL — `KeyError: 'field_count'`

- [ ] **Step 3: Add `field_count` to `_group_dict` in `get_field_tree`**

  In `apps/api/src/routes/uploads.py`, update `_group_dict` (line ~414):

  ```python
  def _group_dict(g):
      group_field_count = sum(1 for f in fields if f.upload_fieldgroup_id == g.id)
      return {
          "id": g.id,
          "name": g.name,
          "parent_id": g.parent_id,
          "sort_order": g.sort_order,
          "field_count": group_field_count,
      }
  ```

  (`fields` is already in scope from the surrounding `get_field_tree` function.)

- [ ] **Step 4: Run test to confirm it passes**

  ```
  just test-api -k test_field_tree_groups_include_field_count
  ```
  Expected: PASS

- [ ] **Step 5: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): include field_count per group in field-tree response
  ```
  Then:
  ```
  git add apps/api/src/routes/uploads.py apps/api/tests/test_field_tree.py
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 13: Group field counts in Step 5 — frontend

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldTree.tsx` (update `GroupNode` type)
- Modify: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`

- [ ] **Step 1: Add `field_count` to `GroupNode` type**

  In `FieldTree.tsx`, update the `GroupNode` interface:

  ```typescript
  export interface GroupNode {
    id: number
    name: string
    parent_id: number | null
    sort_order: number
    field_count?: number
  }
  ```

- [ ] **Step 2: Update the `groups` type in `Step5ReviewCommit.tsx`**

  In `Step5ReviewCommit.tsx`, update the `groups` type inside `SessionSummary`:

  ```typescript
  groups: { id: number; name: string; parent_id: number | null; field_count?: number }[]
  ```

- [ ] **Step 3: Show field counts in the Group structure card**

  In `Step5ReviewCommit.tsx`, update the top-groups render to show field counts:

  ```tsx
  {topGroups.map((g) => (
    <div key={g.id} className="flex items-center gap-2">
      <span
        className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-accent"
        aria-hidden="true"
      />
      <span className="flex-1 font-medium">{g.name}</span>
      {g.field_count !== undefined && (
        <span className="text-muted-foreground">{g.field_count} field{g.field_count !== 1 ? "s" : ""}</span>
      )}
    </div>
  ))}
  ```

- [ ] **Step 4: Regenerate types**

  ```
  just generate-types
  ```

- [ ] **Step 5: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): show field counts per group in Step 5 group structure summary
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/FieldTree.tsx apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx packages/shared/api.d.ts
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 14: Step 5 reconciliation summary — colored chips

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx`

- [ ] **Step 1: Replace the four text rows with colored chip-style rows**

  In the Reconciliation card body, replace the four `<div className="flex gap-2">` rows with:

  ```tsx
  <div className="mt-1 flex flex-wrap gap-2">
    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
      ✓ {summary.recon.exact} exact
    </span>
    <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200">
      ✓ {summary.recon.confirmed} confirmed
    </span>
    <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
      + {summary.recon.new_only} new
    </span>
    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      — {summary.recon.excluded} excluded
    </span>
  </div>
  ```

  Keep the reference dataset name row above (the `<div className="flex gap-2">` for "Reference").

- [ ] **Step 2: Verify in browser** — complete a reconciliation upload and navigate to Step 5. Confirm the reconciliation summary shows green/blue/muted chip badges.

- [ ] **Step 3: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): use colored chip badges in Step 5 reconciliation summary
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/Step5ReviewCommit.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 15: File size + row count preview in Step 1 drop zone

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx`

The POST `/api/v1/uploads` response already includes `row_count`. File size is available from the `File` object.

- [ ] **Step 1: Add `uploadPreview` state**

  ```typescript
  const [uploadPreview, setUploadPreview] = useState<{
    fileName: string
    sizeKb: number
    rowCount: number
  } | null>(null)
  ```

- [ ] **Step 2: Set preview in `handleNext` after successful upload**

  After `setSessionId(data.id)`, add:

  ```typescript
  setUploadPreview({
    fileName: file.name,
    sizeKb: Math.round(file.size / 1024),
    rowCount: data.row_count ?? 0,
  })
  ```

- [ ] **Step 3: Show the preview in the drop zone**

  Update the drop-zone content block (the `{file ? ... : ...}` branch):

  ```tsx
  {uploadPreview ? (
    <div className="space-y-1 text-center">
      <p className="font-medium text-foreground text-sm">{uploadPreview.fileName}</p>
      <p className="text-muted-foreground text-xs">
        {uploadPreview.sizeKb} KB · {uploadPreview.rowCount} rows
      </p>
    </div>
  ) : file ? (
    <p className="font-medium text-foreground text-sm">{file.name}</p>
  ) : (
    <>
      <p className="font-medium text-muted-foreground text-sm">
        Drag a CSV here or click to browse
      </p>
      <p className="mt-1 text-muted-foreground text-xs">Accepts .csv</p>
    </>
  )}
  ```

  Reset `uploadPreview` in `handleFileChange`:

  ```typescript
  function handleFileChange(f: File | null) {
    setFile(f)
    setUploadPreview(null)
    if (f && !datasetName) {
      setDatasetName(f.name.replace(/\.[^.]+$/, ""))
    }
  }
  ```

- [ ] **Step 4: Verify in browser** — upload a CSV, confirm the drop zone updates to show the filename, KB size, and row count.

- [ ] **Step 5: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): show file size and row count preview in Step 1 drop zone after upload
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/Step1FileHierarchy.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 16: Empty state illustration on /datasets

**Files:**
- Modify: `apps/web/src/app/datasets/DatasetsPage.tsx`

- [ ] **Step 1: Replace the text-only empty state with an illustrated empty state**

  Replace the current empty state block (the `filtered.length === 0` branch):

  ```tsx
  <div className="rounded-lg border border-border border-dashed py-20 text-center">
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto mb-4 text-muted-foreground/40"
      aria-hidden="true"
    >
      <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="24" x2="56" y2="24" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="12" x2="20" y2="52" stroke="currentColor" strokeWidth="2" />
      <circle cx="44" cy="44" r="10" fill="currentColor" opacity="0.15" />
      <line x1="44" y1="40" x2="44" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="44" y1="46" x2="44" y2="48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <p className="font-semibold text-muted-foreground text-sm">No datasets yet</p>
    <p className="mt-1 text-muted-foreground text-xs">
      Upload a CSV to get started
    </p>
    <Link
      href="/datasets/upload"
      className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 font-semibold text-sm text-white hover:opacity-90"
    >
      Upload your first dataset →
    </Link>
  </div>
  ```

- [ ] **Step 2: Verify in browser** — filter to a package with no datasets (or clear all data) and confirm the illustration and CTA appear.

- [ ] **Step 3: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): add illustrated empty state to /datasets page
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/DatasetsPage.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

## Task 17: "+ New group" button in right panel group assignment

**Files:**
- Modify: `apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx`
- Modify: `apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx`

- [ ] **Step 1: Add `onCreateGroup` prop to `FieldEditorPanel`**

  Update the Props interface:

  ```typescript
  interface Props {
    sessionId: number
    field: FieldNode | null
    groups: GroupNode[]
    onSaved: (updated: FieldNode) => void
    onCancel: () => void
    onDelete: () => Promise<void>
    onCreateGroup: (name: string, parentId: number | null) => Promise<GroupNode>
  }
  ```

  Update the function signature accordingly.

- [ ] **Step 2: Add the "+ New group" button next to the group selector**

  Replace the Group `<div>` in `FieldEditorPanel`:

  ```tsx
  <div>
    <label className="mb-1 block font-semibold text-muted-foreground text-xs" htmlFor="field-group">
      Group
    </label>
    <div className="flex gap-2">
      <select
        id="field-group"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <option value="">— Unassigned —</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {groupPath(g)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={async () => {
          const name = window.prompt("New group name:")
          if (!name?.trim()) return
          const newGroup = await onCreateGroup(name.trim(), null)
          setGroupId(String(newGroup.id))
        }}
        className="rounded border border-border px-2 py-1 font-semibold text-accent text-xs hover:bg-muted"
        title="Create a new top-level group and assign field to it"
      >
        + New
      </button>
    </div>
  </div>
  ```

- [ ] **Step 3: Wire `onCreateGroup` in `Step4MetadataEditor`**

  Pass a handler that calls the API and re-fetches the tree, returning the new group:

  ```tsx
  <FieldEditorPanel
    ...
    onCreateGroup={async (name, parentId) => {
      if (!state.sessionId) throw new Error("No session")
      const r = await fetch(
        `${API_BASE}/api/v1/uploads/${state.sessionId}/fieldgroups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, parent_id: parentId }),
        },
      )
      const newGroup = await r.json()
      await loadTree()
      return newGroup
    }}
  />
  ```

- [ ] **Step 4: Verify in browser** — select a field in the right panel, click "+ New" next to the group selector, enter a name, confirm a new group is created and the field is moved into it.

- [ ] **Step 5: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): add "+ New group" button in field editor right panel
  ```
  Then:
  ```
  git add apps/web/src/app/datasets/upload/steps/FieldEditorPanel.tsx apps/web/src/app/datasets/upload/steps/Step4MetadataEditor.tsx
  git commit -F /tmp/commit-msg.txt
  ```

---

---

## Explicitly out of scope

**Levels drag-handle reordering** — The spec calls for a drag handle per level row to reorder levels. Implementing dnd-kit sortable inside a form (alongside the existing field-tree DndContext) requires a nested DndContext and sensor disambiguation. The sort order is already editable via the existing `sort_order` integer field on each level (set when saving). Defer drag-handle reordering to a dedicated pass.

**Searchable group combobox** — The spec calls for a searchable dropdown in the right panel group assignment. The plain `<select>` shows full group paths via `groupPath()` and works for all current datasets. A Combobox upgrade can be done when the shadcn `Combobox` component is standardised across the app.

---

## Final: Run full test suite and typecheck

- [ ] **Step 1: Run all tests**

  ```
  just test
  ```
  Expected: all tests pass

- [ ] **Step 2: Run typechecks**

  ```
  just typecheck
  ```
  Expected: no type errors

- [ ] **Step 3: Run linter**

  ```
  just lint
  ```
  Fix any issues with `just lint-fix`, then commit fixes if any.
