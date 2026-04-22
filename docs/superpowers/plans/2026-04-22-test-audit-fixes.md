# Test Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the security and coverage gaps identified in the test audit, and fix low-signal test names.

**Architecture:** Two production code changes (add router-level auth to uploads, add auth to `POST /packages`) followed by targeted integration tests. Test renames are mechanical edits to existing test functions.

**Tech Stack:** pytest-asyncio, httpx AsyncClient, FastAPI dependency overrides, `patch("src.auth.settings")`

---

## Files Modified

| File | Change |
|---|---|
| `apps/api/src/routes/uploads.py` | Add router-level `Depends(get_current_user)` |
| `apps/api/src/routes/packages.py` | Add `CurrentUser` dep to `POST /packages` |
| `apps/api/tests/test_auth_integration.py` | Add 3 new auth tests (uploads, POST /packages, download inaccessible) |
| `apps/api/tests/test_access_control.py` | Add trend cross-org isolation test |
| `apps/api/tests/test_packages.py` | Rename `test_create_package` |
| `apps/api/tests/test_collections.py` | Rename `test_create_collection` |
| `apps/api/tests/test_datasets.py` | Rename `test_delete_dataset` |
| `apps/api/tests/test_groups_api.py` | Rename `test_create_group` |
| `apps/api/tests/test_consistency.py` | Rename `test_consistency_endpoint` |

---

## Task 1: Add router-level auth to uploads

**Files:**
- Modify: `apps/api/src/routes/uploads.py` (line 36 — the `APIRouter(...)` call)

FastAPI supports router-level dependencies so we don't need to touch each of the 20+ route functions.

- [ ] **Step 1: Edit the router declaration**

In `apps/api/src/routes/uploads.py`, change line 36 from:

```python
from src.database import get_session
from src.errors import DomainError
```

Add the import for `get_current_user`, then add a `dependencies` argument to the router. The full top-of-file imports block becomes:

```python
from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.errors import DomainError
```

And change line 36:
```python
router = APIRouter(tags=["uploads"])
```
to:
```python
router = APIRouter(tags=["uploads"], dependencies=[Depends(get_current_user)])
```

(The `Depends` import is already present from `fastapi`.)

- [ ] **Step 2: Run the existing uploads tests to confirm nothing broke**

```bash
just test-api -k uploads
```
Expected: All existing uploads tests pass. The `client` fixture overrides `get_current_user`, so the router-level dependency is satisfied automatically.

- [ ] **Step 3: Commit**

Write commit message to `/tmp/commit-msg.txt`:
```
fix(api): enforce authentication on all uploads routes

All /uploads/* endpoints were missing a CurrentUser dependency, allowing
anonymous users to create upload sessions, modify field mappings, and
commit datasets. Added router-level Depends(get_current_user) which
applies to all routes without changing individual signatures.
```
Then: `git add apps/api/src/routes/uploads.py && git commit -F /tmp/commit-msg.txt`

---

## Task 2: Add auth to POST /packages

**Files:**
- Modify: `apps/api/src/routes/packages.py` (the `create_package` route function)

- [ ] **Step 1: Add `CurrentUser` dependency to `create_package`**

In `apps/api/src/routes/packages.py`, the `create_package` function currently has no auth. Change it to:

```python
@router.post("/packages", response_model=PackageRead, status_code=201)
async def create_package(
    body: PackageCreate,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new package."""
    return await package_service.create_package(
        session, name=body.name, slug=body.slug, description=body.description
    )
```

(`CurrentUser` is already imported on line 5 of that file.)

- [ ] **Step 2: Run existing package tests to confirm nothing broke**

```bash
just test-api -k packages
```
Expected: All existing package tests pass (the `client` fixture satisfies the new dependency).

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
fix(api): require authentication for POST /packages

The create_package route had no CurrentUser dependency, allowing anonymous
callers to create packages. Added Depends(get_current_user) to match the
auth pattern on GET /packages.
```
Then: `git add apps/api/src/routes/packages.py && git commit -F /tmp/commit-msg.txt`

---

## Task 3: Auth integration tests — uploads and POST /packages

**Files:**
- Modify: `apps/api/tests/test_auth_integration.py` (append three new tests)

The existing pattern (see `test_protected_route_without_auth_returns_401`) uses `patch("src.auth.settings")` with `auth_mode = "jwt"` and a fresh `AsyncClient` with no dependency overrides.

- [ ] **Step 1: Write the failing tests first (TDD — they should FAIL before Task 1/2 are done, PASS after)**

Actually Tasks 1 and 2 are already done. Run the tests below first to confirm they now pass:

Append to `apps/api/tests/test_auth_integration.py`:

```python
@pytest.mark.asyncio
async def test_upload_route_without_auth_returns_401():
    """POST /uploads must reject unauthenticated requests after auth was added to router."""
    import io
    with patch("src.auth.settings") as mock_settings:
        mock_settings.auth_mode = "jwt"
        mock_settings.clerk_jwt_key = ""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/uploads",
                files={"file": ("test.csv", io.BytesIO(b"col\nval"), "text/csv")},
                data={"dataset_name": "Test"},
            )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_package_without_auth_returns_401():
    """POST /packages must reject unauthenticated requests."""
    with patch("src.auth.settings") as mock_settings:
        mock_settings.auth_mode = "jwt"
        mock_settings.clerk_jwt_key = ""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/packages",
                json={"name": "Sneaky Package"},
            )
    assert response.status_code == 401
```

- [ ] **Step 2: Run the new tests**

```bash
just test-api -k "test_upload_route_without_auth or test_create_package_without_auth"
```
Expected: Both pass with 401.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): add auth regression tests for uploads and package creation

Verify that POST /uploads and POST /packages both return 401 when called
without a bearer token. Guards against future accidental removal of the
CurrentUser dependency on these routes.
```
Then:
```
git add apps/api/tests/test_auth_integration.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: Test that GET /datasets/{id}/download returns 404 when inaccessible

**Files:**
- Modify: `apps/api/tests/test_auth_integration.py` (append one more test)

The existing `test_dataset_route_returns_404_when_inaccessible` in `test_access_control.py` covers `GET /datasets/{id}` but not the `/download` sub-route. The download route calls the same `get_csv_data` service which has the same accessibility guard — but a regression there would silently serve CSV data.

- [ ] **Step 1: Append the test**

Add to `apps/api/tests/test_auth_integration.py` (this needs the `db` fixture, so it can't be a plain `@pytest.mark.asyncio` test without the fixture — add it using the same pattern as `test_webhook_route_without_auth_returns_400_not_401` which injects a mock session, but for this test we actually need a real seeded dataset, so model it after `test_access_control.py`):

Actually the cleanest place is `test_access_control.py` since it already has the `seeded_collection`, `seeded_package`, and `bare_dataset` fixtures and sets up the access-control dependency overrides. Append to `apps/api/tests/test_access_control.py`:

```python
@pytest.mark.asyncio
async def test_dataset_download_returns_404_when_inaccessible(
    client, db, bare_dataset
):
    """GET /datasets/{id}/download returns 404 when the dataset's package is not accessible."""
    from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
    from src.main import app

    def override_user() -> CurrentUser:
        return CurrentUser(clerk_id="no_access_user", email="noaccess@test.com", org_id=None)

    async def override_accessible() -> set[int] | None:
        return set()  # no packages accessible

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_accessible_package_ids] = override_accessible

    resp = await client.get(f"/api/v1/datasets/{bare_dataset.id}/download")

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_accessible_package_ids, None)

    assert resp.status_code == 404
```

- [ ] **Step 2: Run the new test**

```bash
just test-api -k test_dataset_download_returns_404_when_inaccessible
```
Expected: PASS.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): verify dataset download returns 404 for inaccessible dataset

The /download sub-route had no access-control regression test. A bug in
the accessibility guard would silently stream CSV data to unauthorised
users. This test guards that path.
```
Then:
```
git add apps/api/tests/test_access_control.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 5: Trend analytics cross-org isolation test

**Files:**
- Modify: `apps/api/tests/test_access_control.py` (append one test)

`test_analytics_rejects_inaccessible_dataset` covers the crosstab endpoint. The trend endpoint has the same guard (`_assert_collection_accessible`) but no test exercising it.

- [ ] **Step 1: Append the test**

The trend endpoint takes `collection_id`, not `dataset_id`. The accessibility check is via `package_repo.get_package_ids_for_collection`. Append to `apps/api/tests/test_access_control.py`:

```python
@pytest.mark.asyncio
async def test_trend_rejects_inaccessible_collection(client, db, seeded_collection):
    """POST /analytics/trend returns 403 when the collection's package is not accessible."""
    from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
    from src.main import app

    def override_user() -> CurrentUser:
        return CurrentUser(clerk_id="no_access_user", email="noaccess@test.com", org_id=None)

    async def override_accessible() -> set[int] | None:
        return set()  # no packages accessible

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_accessible_package_ids] = override_accessible

    resp = await client.post(
        "/api/v1/analytics/trend",
        json={
            "collection_id": seeded_collection.id,
            "fields": [{"field_key": "gender"}],
            "filters": [],
            "measure": {"type": "count", "field_key": None, "aggregation": None, "display": "n"},
        },
    )

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_accessible_package_ids, None)

    assert resp.status_code == 403
```

- [ ] **Step 2: Run the new test**

```bash
just test-api -k test_trend_rejects_inaccessible_collection
```
Expected: PASS.

- [ ] **Step 3: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): verify trend endpoint rejects inaccessible collection

test_analytics_rejects_inaccessible_dataset only covered the crosstab
endpoint. This test guards the same access-control path on POST /analytics/trend.
```
Then:
```
git add apps/api/tests/test_access_control.py
git commit -F /tmp/commit-msg.txt
```

---

## Task 6: Rename low-signal tests

**Files:**
- Modify: `apps/api/tests/test_packages.py`
- Modify: `apps/api/tests/test_collections.py`
- Modify: `apps/api/tests/test_datasets.py`
- Modify: `apps/api/tests/test_groups_api.py`
- Modify: `apps/api/tests/test_consistency.py`

Convention from `docs/testing.md`: `test_<thing>_<condition>_<expected_outcome>`.

- [ ] **Step 1: Rename in test_packages.py**

In `apps/api/tests/test_packages.py`, rename:
```python
async def test_create_package(client):
```
to:
```python
async def test_create_package_with_explicit_slug_returns_201_with_slug_and_id(client):
```

- [ ] **Step 2: Rename in test_collections.py**

In `apps/api/tests/test_collections.py`, rename:
```python
async def test_create_collection(client, db):
```
to:
```python
async def test_create_collection_with_explicit_slug_returns_201_with_name_and_id(client, db):
```

- [ ] **Step 3: Rename in test_datasets.py**

In `apps/api/tests/test_datasets.py`, rename:
```python
async def test_delete_dataset(client, db):
```
to:
```python
async def test_delete_dataset_returns_204_and_subsequent_get_returns_404(client, db):
```

- [ ] **Step 4: Rename in test_groups_api.py**

In `apps/api/tests/test_groups_api.py`, rename:
```python
async def test_create_group(client, group_fixtures, db):
```
to:
```python
async def test_create_group_with_org_user_returns_201_with_name(client, group_fixtures, db):
```

- [ ] **Step 5: Rename in test_consistency.py**

In `apps/api/tests/test_consistency.py`, rename:
```python
async def test_consistency_endpoint(client, db):
```
to:
```python
async def test_consistency_endpoint_with_type_mismatch_returns_inconsistency_detail(client, db):
```

- [ ] **Step 6: Run all tests to confirm all renames are clean**

```bash
just test-api
```
Expected: All tests pass. No `ERRORS` about unknown test IDs.

- [ ] **Step 7: Commit**

Write to `/tmp/commit-msg.txt`:
```
test(api): rename low-signal tests to follow naming convention

Apply the test_<thing>_<condition>_<expected_outcome> naming pattern to
five tests that only described the action being performed. No logic was
changed — names only.
```
Then:
```
git add apps/api/tests/test_packages.py apps/api/tests/test_collections.py apps/api/tests/test_datasets.py apps/api/tests/test_groups_api.py apps/api/tests/test_consistency.py
git commit -F /tmp/commit-msg.txt
```

---

## Final check

- [ ] Run the full test suite

```bash
just test
```
Expected: All tests pass (pytest + vitest).
