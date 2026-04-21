# AuthN & AuthZ Phase 2 — Gap Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill 20 identified gaps in the Phase 2 AuthN & AuthZ implementation: enforce `accessible_ids` on `/collections` and `/datasets` routes, add missing admin package-management and group-detail endpoints, and implement the currently-stub `/org/groups` panels and `/admin` PackagesTab composition panel.

**Architecture:** Backend work is structured in the existing 3-layer pattern (routes → services → repositories). New org-level endpoints live in a new `routes/org.py`. Admin collection-management routes extend the existing `routes/admin.py`. Frontend panels replace stub components in place, consuming the new backend endpoints via openapi-fetch with auto-generated types.

**Tech Stack:** FastAPI + SQLModel + AsyncSession (backend), Next.js App Router + openapi-fetch + Clerk + shadcn/ui (frontend), pytest + httpx (tests), Playwright (E2E).

**Dependency order:** Tasks 1–7 (backend) must complete before Task 8 (generate-types). Tasks 9–12 (frontend) depend on Task 8 for generated types.

---

## File Map

**Create:**
- `apps/api/src/routes/org.py` — GET /org/members, GET /org/subscriptions
- `apps/api/src/services/org_service.py` — org-level business logic
- `apps/api/tests/test_org_api.py` — org endpoint tests
- `apps/api/tests/test_package_collection_admin.py` — admin collection CRUD tests
- `apps/web/src/app/org/groups/MembersPanel.stories.tsx` — Storybook story
- `apps/web/src/app/org/groups/PackagesPanel.stories.tsx` — Storybook story

**Modify:**
- `apps/api/src/repositories/package_repo.py` — add `get_package_ids_for_collection`, `get_package_ids_for_dataset`, `get_org_subscribed_packages`
- `apps/api/src/repositories/user_repo.py` — add `get_org_members`
- `apps/api/src/repositories/group_repo.py` — add `get_members_for_group`, `get_packages_for_group`
- `apps/api/src/repositories/admin_repo.py` — add package collection CRUD functions
- `apps/api/src/repositories/collection_repo.py` — add `get_all` if missing
- `apps/api/src/services/collection_service.py` — add `accessible_ids` param to `get_with_datasets`, `get_consistency`
- `apps/api/src/services/dataset_service.py` — add `accessible_ids` param to all read functions
- `apps/api/src/services/group_service.py` — add `list_group_members`, `list_group_packages`
- `apps/api/src/services/admin_service.py` — add `list_packages`, `create_package`, `list_collections`, `list_package_collections`, `add_collection_to_package`, `update_collection_scope`, `remove_collection_from_package`, `add_dataset_inclusion`, `remove_dataset_inclusion`
- `apps/api/src/routes/admin.py` — add GET/POST /admin/packages, GET /admin/collections, package-collection CRUD routes
- `apps/api/src/routes/collections.py` — add `accessible_ids` dependency to GET routes
- `apps/api/src/routes/datasets.py` — add `accessible_ids` dependency to all routes
- `apps/api/src/routes/groups.py` — add GET /groups/{id}/members, GET /groups/{id}/packages
- `apps/api/src/models/group.py` — add `PackageCollectionDetail`, `AddCollectionBody`, `UpdateScopeBody`, `AddDatasetBody`
- `apps/api/src/models/user.py` — add `OrgMemberRead`
- `apps/api/src/main.py` — register org router
- `apps/api/src/repositories/dataset_repo.py` — add `accessible_package_ids` param to `list_enriched`
- `apps/web/src/app/org/groups/GroupsList.tsx` — sort, pagination, create modal, delete, role gating
- `apps/web/src/app/org/groups/GroupsPage.tsx` — pass `isDefault` to MembersPanel
- `apps/web/src/app/org/groups/MembersPanel.tsx` — full implementation
- `apps/web/src/app/org/groups/PackagesPanel.tsx` — full implementation
- `apps/web/src/app/admin/PackagesTab.tsx` — implement PackageCompositionPanel

---

## Task 1: package_repo — Accessibility helpers

**Files:**
- Modify: `apps/api/src/repositories/package_repo.py`
- Test: `apps/api/tests/test_access_control.py`

- [ ] **Step 1: Add two helper functions to package_repo**

  Append after `get_collections_for_package` in `apps/api/src/repositories/package_repo.py`:

  ```python
  async def get_package_ids_for_collection(
      session: AsyncSession, collection_id: int
  ) -> set[int]:
      """Return the set of package IDs that contain the given collection."""
      result = await session.execute(
          select(PackageCollection.package_id).where(
              PackageCollection.collection_id == collection_id
          )
      )
      return {cast(int, row) for row in result.scalars().all()}


  async def get_package_ids_for_dataset(
      session: AsyncSession, dataset_id: int
  ) -> set[int]:
      """Return the set of package IDs that contain the given dataset's collection."""
      from src.models.dataset import Dataset  # local import to avoid circular

      dataset_subq = (
          select(Dataset.collection_id).where(Dataset.id == dataset_id).scalar_subquery()
      )
      result = await session.execute(
          select(PackageCollection.package_id).where(
              PackageCollection.collection_id == dataset_subq
          )
      )
      return {cast(int, row) for row in result.scalars().all()}
  ```

  `cast` is already imported at the top of package_repo. `PackageCollection` is already imported.

- [ ] **Step 2: Write failing tests**

  Add to `apps/api/tests/test_access_control.py`:

  ```python
  async def test_get_package_ids_for_collection_returns_linked_package(session, seed_package, seed_collection):
      """After a collection is linked to a package via package_collections, the helper returns that package ID."""
      # seed_package and seed_collection are fixtures that create a Package and a Collection
      # linked via package_collections. Follow the fixture pattern in this test file.
      from src.repositories import package_repo
      pkg_ids = await package_repo.get_package_ids_for_collection(session, seed_collection.id)
      assert seed_package.id in pkg_ids


  async def test_get_package_ids_for_dataset_returns_linked_package(session, seed_package, seed_collection, seed_dataset):
      from src.repositories import package_repo
      pkg_ids = await package_repo.get_package_ids_for_dataset(session, seed_dataset.id)
      assert seed_package.id in pkg_ids
  ```

  Follow the exact fixture and `async_session` patterns used in existing tests in this file.

- [ ] **Step 3: Run tests to verify they pass**

  ```bash
  just test-api -k "test_get_package_ids"
  ```

  Expected: both tests PASS.

- [ ] **Step 4: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add package_repo helpers get_package_ids_for_collection/dataset
  ```
  Then: `git add apps/api/src/repositories/package_repo.py apps/api/tests/test_access_control.py`

---

## Task 2: accessible_ids for /collections routes

**Files:**
- Modify: `apps/api/src/services/collection_service.py`
- Modify: `apps/api/src/routes/collections.py`
- Test: `apps/api/tests/test_access_control.py`

- [ ] **Step 1: Write failing test**

  Add to `apps/api/tests/test_access_control.py`:

  ```python
  async def test_collection_route_returns_404_when_inaccessible(client, seed_private_package, seed_collection):
      """GET /collections/{id} returns 404 when the user cannot access the package."""
      # Override get_current_user to return a user with no org (cannot access private packages)
      from src.auth import CurrentUser, get_current_user
      from src.main import app

      app.dependency_overrides[get_current_user] = lambda: CurrentUser(
          clerk_id="user_external", email="x@example.com", org_id=None, is_superuser=False
      )
      response = await client.get(f"/api/v1/collections/{seed_collection.id}")
      app.dependency_overrides.pop(get_current_user, None)
      assert response.status_code == 404
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  just test-api -k "test_collection_route_returns_404_when_inaccessible"
  ```

  Expected: FAIL (currently returns 200 regardless of access).

- [ ] **Step 3: Update collection_service.py**

  Modify the signatures of `get_with_datasets` and `get_consistency` in `apps/api/src/services/collection_service.py`. Add `accessible_ids: set[int] | None = None` as the last parameter, and insert the access check after the existence check:

  ```python
  async def get_with_datasets(
      session: AsyncSession,
      collection_id: int,
      accessible_ids: set[int] | None = None,
  ) -> CollectionWithDatasets:
      collection = await collection_repo.get_by_id(session, collection_id)
      if collection is None:
          raise CollectionNotFoundError(collection_id)
      if accessible_ids is not None:
          from src.repositories import package_repo
          pkg_ids = await package_repo.get_package_ids_for_collection(session, collection_id)
          if not pkg_ids & accessible_ids:
              raise CollectionNotFoundError(collection_id)
      # ... rest of function unchanged
  ```

  Apply the same pattern to `get_consistency`:

  ```python
  async def get_consistency(
      session: AsyncSession,
      collection_id: int,
      accessible_ids: set[int] | None = None,
  ) -> list[InconsistencyOut]:
      collection = await collection_repo.get_by_id(session, collection_id)
      if collection is None:
          raise CollectionNotFoundError(collection_id)
      if accessible_ids is not None:
          from src.repositories import package_repo
          pkg_ids = await package_repo.get_package_ids_for_collection(session, collection_id)
          if not pkg_ids & accessible_ids:
              raise CollectionNotFoundError(collection_id)
      # ... rest of function unchanged
  ```

  Use 404 (not 403) to avoid information leakage — an inaccessible collection looks non-existent.

- [ ] **Step 4: Update routes/collections.py**

  Replace the `_: CurrentUser = Depends(get_current_user)` dependency with `accessible_ids` on the two GET routes. Add the import:

  ```python
  from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
  ```

  Update `get_collection`:

  ```python
  @router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
  async def get_collection(
      collection_id: int,
      _: CurrentUser = Depends(get_current_user),
      accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
      session: AsyncSession = Depends(get_session),
  ):
      """Get a collection with all its datasets."""
      return await collection_service.get_with_datasets(session, collection_id, accessible_ids)
  ```

  Update `get_collection_consistency` the same way:

  ```python
  @router.get(
      "/collections/{collection_id}/consistency",
      response_model=list[InconsistencyOut],
  )
  async def get_collection_consistency(
      collection_id: int,
      _: CurrentUser = Depends(get_current_user),
      accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
      session: AsyncSession = Depends(get_session),
  ):
      """List field inconsistencies across datasets in a collection (e.g. mismatched types or labels)."""
      return await collection_service.get_consistency(session, collection_id, accessible_ids)
  ```

  Leave `POST /collections` unchanged — write operations do not require accessible_ids.

- [ ] **Step 5: Run test to verify it passes**

  ```bash
  just test-api -k "test_collection_route_returns_404_when_inaccessible"
  ```

  Expected: PASS.

- [ ] **Step 6: Run full test suite to confirm no regressions**

  ```bash
  just test-api
  ```

- [ ] **Step 7: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): enforce accessible_ids on /collections GET routes
  ```
  Then: `git add apps/api/src/services/collection_service.py apps/api/src/routes/collections.py apps/api/tests/test_access_control.py`

---

## Task 3: accessible_ids for /datasets routes

**Files:**
- Modify: `apps/api/src/repositories/dataset_repo.py`
- Modify: `apps/api/src/services/dataset_service.py`
- Modify: `apps/api/src/routes/datasets.py`
- Test: `apps/api/tests/test_access_control.py`

- [ ] **Step 1: Write failing test**

  Add to `apps/api/tests/test_access_control.py`:

  ```python
  async def test_dataset_route_returns_404_when_inaccessible(client, seed_private_package, seed_dataset):
      """GET /datasets/{id} returns 404 when the user cannot access the package."""
      from src.auth import CurrentUser, get_current_user
      from src.main import app

      app.dependency_overrides[get_current_user] = lambda: CurrentUser(
          clerk_id="user_external", email="x@example.com", org_id=None, is_superuser=False
      )
      response = await client.get(f"/api/v1/datasets/{seed_dataset.id}")
      app.dependency_overrides.pop(get_current_user, None)
      assert response.status_code == 404
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  just test-api -k "test_dataset_route_returns_404_when_inaccessible"
  ```

  Expected: FAIL.

- [ ] **Step 3: Add accessible_package_ids param to dataset_repo.list_enriched**

  Open `apps/api/src/repositories/dataset_repo.py`. Locate `list_enriched`. Add `accessible_package_ids: set[int] | None = None`. When not None, join to `package_collections` and filter:

  ```python
  async def list_enriched(
      session: AsyncSession,
      collection_id: int | None = None,
      page: int = 1,
      page_size: int = 50,
      accessible_package_ids: set[int] | None = None,
  ) -> tuple[int, list[...]]:  # return type unchanged
      from src.models.group import PackageCollection

      q = ...  # existing base query

      if accessible_package_ids is not None:
          accessible_collection_ids_subq = (
              select(PackageCollection.collection_id)
              .where(PackageCollection.package_id.in_(accessible_package_ids))
              .scalar_subquery()
          )
          q = q.where(Dataset.collection_id.in_(accessible_collection_ids_subq))

      if collection_id is not None:
          q = q.where(Dataset.collection_id == collection_id)

      # ... rest of pagination logic unchanged
  ```

  Place the `accessible_package_ids` filter before the `collection_id` filter.

- [ ] **Step 4: Update dataset_service.py**

  Add `accessible_ids: set[int] | None = None` to `get_with_fields`, `delete_dataset`, `get_responses`, and `get_csv_data`. In each, add an access check after the existence check:

  ```python
  async def get_with_fields(
      session: AsyncSession,
      dataset_id: int,
      accessible_ids: set[int] | None = None,
  ) -> DatasetWithFields:
      dataset = await dataset_repo.get_by_id(session, dataset_id)
      if dataset is None:
          raise DatasetNotFoundError(dataset_id)
      if accessible_ids is not None:
          from src.repositories import package_repo
          pkg_ids = await package_repo.get_package_ids_for_dataset(session, dataset_id)
          if not pkg_ids & accessible_ids:
              raise DatasetNotFoundError(dataset_id)
      # ... rest unchanged
  ```

  Apply the same `if accessible_ids is not None` block to `delete_dataset`, `get_responses`, and `get_csv_data`.

  For `analytics_service.get_field_tree` and `get_weight_fields`, those already call `_assert_dataset_accessible` (which uses `accessible_ids`) from the analytics route. No changes needed there — but the datasets route will now also guard them. Add `accessible_ids` param to the analytics_service functions if needed (read those function signatures first).

- [ ] **Step 5: Update routes/datasets.py**

  Add the import:

  ```python
  from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
  ```

  For each route, replace `_: CurrentUser = Depends(get_current_user)` with:

  ```python
  _: CurrentUser = Depends(get_current_user),
  accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
  ```

  Pass `accessible_ids` to the service calls. For `list_datasets`:

  ```python
  @router.get("/datasets", response_model=DatasetListPage)
  async def list_datasets(
      collection_id: int | None = None,
      page: int = Query(default=1, ge=1),
      page_size: int = Query(default=50, ge=1, le=200),
      _: CurrentUser = Depends(get_current_user),
      accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
      session: AsyncSession = Depends(get_session),
  ):
      """List datasets, optionally filtered by collection_id."""
      total, items = await dataset_repo.list_enriched(
          session,
          collection_id=collection_id,
          page=page,
          page_size=page_size,
          accessible_package_ids=accessible_ids,
      )
      return {"total": total, "page": page, "page_size": page_size, "items": items}
  ```

  For `get_dataset`, `delete_dataset`, `get_dataset_responses`, `download_dataset_csv`:

  ```python
  return await dataset_service.get_with_fields(session, dataset_id, accessible_ids)
  ```

  For `get_field_tree` and `get_weight_fields` (which call analytics_service): pass `accessible_ids` if those functions accept it; otherwise the analytics_service's own `_assert_dataset_accessible` already guards them — but you should still read those function signatures and pass if supported.

- [ ] **Step 6: Run tests**

  ```bash
  just test-api -k "test_dataset_route_returns_404_when_inaccessible"
  ```

  Expected: PASS. Then:

  ```bash
  just test-api
  ```

  Fix any regressions.

- [ ] **Step 7: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): enforce accessible_ids on /datasets routes
  ```
  Then: `git add apps/api/src/repositories/dataset_repo.py apps/api/src/services/dataset_service.py apps/api/src/routes/datasets.py apps/api/tests/test_access_control.py`

---

## Task 4: Group detail endpoints — GET members + packages

**Files:**
- Modify: `apps/api/src/repositories/group_repo.py`
- Modify: `apps/api/src/services/group_service.py`
- Modify: `apps/api/src/routes/groups.py`
- Test: `apps/api/tests/test_groups_api.py`

- [ ] **Step 1: Write failing tests**

  Add to `apps/api/tests/test_groups_api.py`:

  ```python
  async def test_list_group_members_returns_members(client, admin_user, seed_group, seed_user_in_group):
      """GET /groups/{id}/members returns the users currently in that group."""
      # admin_user fixture: CurrentUser with org admin role
      # seed_group fixture: a Group row in the test org
      # seed_user_in_group fixture: a User + GroupMembership row linking them to seed_group
      response = await client.get(f"/api/v1/groups/{seed_group.id}/members")
      assert response.status_code == 200
      data = response.json()
      assert any(m["user_id"] == seed_user_in_group.id for m in data)


  async def test_list_group_packages_returns_assigned_packages(client, admin_user, seed_group, seed_package_in_group):
      """GET /groups/{id}/packages returns the packages assigned to that group."""
      response = await client.get(f"/api/v1/groups/{seed_group.id}/packages")
      assert response.status_code == 200
      data = response.json()
      assert any(p["package_id"] == seed_package_in_group.id for p in data)
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  just test-api -k "test_list_group_members_returns_members or test_list_group_packages_returns_assigned_packages"
  ```

  Expected: FAIL with 404 (routes don't exist yet).

- [ ] **Step 3: Add repo functions to group_repo.py**

  Append to `apps/api/src/repositories/group_repo.py`:

  ```python
  async def get_members_for_group(
      session: AsyncSession, group_id: int, org_id: int
  ) -> list[tuple]:
      """Return (user_id, clerk_id, email, display_name, role) rows for all members of a group."""
      from sqlalchemy import select as sa_select

      from src.models.user import OrgMembership, User

      result = await session.execute(
          sa_select(User.id, User.clerk_id, User.email, User.display_name, OrgMembership.role)
          .join(GroupMembership, GroupMembership.user_id == User.id)
          .join(
              OrgMembership,
              (OrgMembership.user_id == User.id) & (OrgMembership.org_id == org_id),
          )
          .where(GroupMembership.group_id == group_id)
      )
      return list(result.all())


  async def get_packages_for_group(
      session: AsyncSession, group_id: int
  ) -> list:
      """Return Package ORM objects for all packages assigned to a group."""
      from src.models.package import Package

      result = await session.execute(
          select(Package)
          .join(GroupPackage, GroupPackage.package_id == Package.id)
          .where(GroupPackage.group_id == group_id)
      )
      return list(result.scalars().all())
  ```

  `GroupMembership`, `GroupPackage`, and `select` are already imported in this file.
  `OrgMembership` and `User` are in `src.models.user` — use local imports to avoid circular issues.

- [ ] **Step 4: Add service functions to group_service.py**

  Add imports at top of `apps/api/src/services/group_service.py`:

  ```python
  from src.models.group import GroupMemberRead, GroupPackageRead
  ```

  Append service functions:

  ```python
  async def list_group_members(
      session: AsyncSession, group_id: int, clerk_org_id: str
  ) -> list[GroupMemberRead]:
      org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
      if org is None:
          return []
      grp = await group_repo.get_group_by_id(session, group_id)
      if grp is None:
          raise GroupNotFoundError(group_id)
      if grp.org_id != org.id:
          raise ForbiddenError("Group belongs to a different org")
      rows = await group_repo.get_members_for_group(session, group_id, cast(int, org.id))
      return [
          GroupMemberRead(
              user_id=row[0],
              clerk_id=row[1],
              email=row[2],
              display_name=row[3],
              role=row[4],
          )
          for row in rows
      ]


  async def list_group_packages(
      session: AsyncSession, group_id: int, clerk_org_id: str
  ) -> list[GroupPackageRead]:
      org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
      if org is None:
          return []
      grp = await group_repo.get_group_by_id(session, group_id)
      if grp is None:
          raise GroupNotFoundError(group_id)
      if grp.org_id != org.id:
          raise ForbiddenError("Group belongs to a different org")
      pkgs = await group_repo.get_packages_for_group(session, group_id)
      return [
          GroupPackageRead(
              package_id=cast(int, p.id),
              name=p.name,
              slug=p.slug,
              visibility=p.visibility,
          )
          for p in pkgs
      ]
  ```

- [ ] **Step 5: Add routes to groups.py**

  Add import at top of `apps/api/src/routes/groups.py`:

  ```python
  from src.models.group import GroupCreate, GroupMemberRead, GroupPackageRead, GroupRead, GroupWithCounts
  ```

  Append routes:

  ```python
  @router.get("/groups/{group_id}/members", response_model=list[GroupMemberRead])
  async def list_group_members(
      group_id: int,
      current_user: CurrentUser = Depends(get_current_user),
      session: AsyncSession = Depends(get_session),
  ):
      """List members of a group with their org role."""
      if current_user.org_id is None:
          return []
      return await group_service.list_group_members(session, group_id, current_user.org_id)


  @router.get("/groups/{group_id}/packages", response_model=list[GroupPackageRead])
  async def list_group_packages(
      group_id: int,
      current_user: CurrentUser = Depends(get_current_user),
      session: AsyncSession = Depends(get_session),
  ):
      """List packages assigned to a group."""
      if current_user.org_id is None:
          return []
      return await group_service.list_group_packages(session, group_id, current_user.org_id)
  ```

- [ ] **Step 6: Run tests**

  ```bash
  just test-api -k "test_list_group_members or test_list_group_packages"
  ```

  Expected: PASS. Then run full suite: `just test-api`.

- [ ] **Step 7: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add GET /groups/{id}/members and GET /groups/{id}/packages endpoints
  ```
  Then: `git add apps/api/src/repositories/group_repo.py apps/api/src/services/group_service.py apps/api/src/routes/groups.py apps/api/tests/test_groups_api.py`

---

## Task 5: Org-level endpoints — GET /org/members and GET /org/subscriptions

**Files:**
- Modify: `apps/api/src/models/user.py` — add `OrgMemberRead`
- Modify: `apps/api/src/repositories/user_repo.py` — add `get_org_members`
- Modify: `apps/api/src/repositories/package_repo.py` — add `get_org_subscribed_packages`
- Create: `apps/api/src/services/org_service.py`
- Create: `apps/api/src/routes/org.py`
- Modify: `apps/api/src/main.py` — register router
- Create: `apps/api/tests/test_org_api.py`

- [ ] **Step 1: Write failing tests**

  Create `apps/api/tests/test_org_api.py`:

  ```python
  import pytest
  from httpx import AsyncClient

  from src.auth import CurrentUser, get_current_user
  from src.main import app


  @pytest.fixture
  def org_member_user(seed_org):
      """CurrentUser with an org_id."""
      user = CurrentUser(
          clerk_id="user_org_member",
          email="member@example.com",
          org_id=seed_org.clerk_org_id,
          is_superuser=False,
      )
      app.dependency_overrides[get_current_user] = lambda: user
      yield user
      app.dependency_overrides.pop(get_current_user, None)


  async def test_list_org_members_returns_members(client, org_member_user, seed_org_membership):
      """GET /org/members returns the org's members with their roles."""
      response = await client.get("/api/v1/org/members")
      assert response.status_code == 200
      data = response.json()
      assert isinstance(data, list)
      assert all("user_id" in m and "role" in m for m in data)


  async def test_list_org_subscriptions_returns_public_packages(client, org_member_user, seed_public_package):
      """GET /org/subscriptions includes public packages."""
      response = await client.get("/api/v1/org/subscriptions")
      assert response.status_code == 200
      ids = [p["id"] for p in response.json()]
      assert seed_public_package.id in ids


  async def test_no_org_returns_empty(client):
      """User with no org gets empty lists for both endpoints."""
      app.dependency_overrides[get_current_user] = lambda: CurrentUser(
          clerk_id="user_no_org", email="x@example.com", org_id=None
      )
      r1 = await client.get("/api/v1/org/members")
      r2 = await client.get("/api/v1/org/subscriptions")
      app.dependency_overrides.pop(get_current_user, None)
      assert r1.json() == []
      assert r2.json() == []
  ```

  Adapt fixture names to match what already exists in `conftest.py`.

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  just test-api -k "test_org_api or test_list_org_members or test_list_org_subscriptions"
  ```

  Expected: FAIL (routes don't exist).

- [ ] **Step 3: Add OrgMemberRead to models/user.py**

  Append to `apps/api/src/models/user.py`:

  ```python
  class OrgMemberRead(SQLModel):
      user_id: int
      clerk_id: str
      email: str
      display_name: str | None
      role: str
  ```

- [ ] **Step 4: Add get_org_members to user_repo.py**

  Read `apps/api/src/repositories/user_repo.py` to identify the OrgMembership model name and User model import. Then append:

  ```python
  async def get_org_members(
      session: AsyncSession, org_id: int
  ) -> list[tuple]:
      """Return (user_id, clerk_id, email, display_name, role) rows for all org members."""
      result = await session.execute(
          select(User.id, User.clerk_id, User.email, User.display_name, OrgMembership.role)
          .join(OrgMembership, OrgMembership.user_id == User.id)
          .where(OrgMembership.org_id == org_id)
      )
      return list(result.all())
  ```

  Use whatever `OrgMembership` model and import style is already in this file.

- [ ] **Step 5: Add get_org_subscribed_packages to package_repo.py**

  Append to `apps/api/src/repositories/package_repo.py`:

  ```python
  async def get_org_subscribed_packages(
      session: AsyncSession, org_id: int
  ) -> list[Package]:
      """Return all packages visible to an org: public packages plus active private subscriptions."""
      from datetime import date as date_type

      today = date_type.today()

      public_pkgs = list(
          (
              await session.execute(select(Package).where(Package.visibility == PackageVisibility.public))
          )
          .scalars()
          .all()
      )
      private_pkgs = list(
          (
              await session.execute(
                  select(Package)
                  .join(OrgSubscription, OrgSubscription.package_id == Package.id)
                  .where(
                      Package.visibility == PackageVisibility.private,
                      OrgSubscription.org_id == org_id,
                      OrgSubscription.start_date <= today,
                      (OrgSubscription.end_date.is_(None)) | (OrgSubscription.end_date >= today),
                  )
              )
          )
          .scalars()
          .all()
      )
      seen = {p.id for p in public_pkgs}
      return public_pkgs + [p for p in private_pkgs if p.id not in seen]
  ```

  `OrgSubscription`, `PackageVisibility`, and `Package` are already imported in this file.

- [ ] **Step 6: Create apps/api/src/services/org_service.py**

  ```python
  from typing import cast

  from sqlalchemy.ext.asyncio import AsyncSession

  from src.models.package import PackageRead
  from src.models.user import OrgMemberRead
  from src.repositories import package_repo, user_repo


  async def list_members(session: AsyncSession, clerk_org_id: str) -> list[OrgMemberRead]:
      org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
      if org is None:
          return []
      rows = await user_repo.get_org_members(session, cast(int, org.id))
      return [
          OrgMemberRead(
              user_id=row[0],
              clerk_id=row[1],
              email=row[2],
              display_name=row[3],
              role=row[4],
          )
          for row in rows
      ]


  async def list_subscribed_packages(session: AsyncSession, clerk_org_id: str) -> list[PackageRead]:
      org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
      if org is None:
          return []
      pkgs = await package_repo.get_org_subscribed_packages(session, cast(int, org.id))
      return [
          PackageRead(
              id=cast(int, p.id),
              name=p.name,
              slug=p.slug,
              description=p.description,
              visibility=p.visibility,
              created_at=p.created_at,
          )
          for p in pkgs
      ]
  ```

- [ ] **Step 7: Create apps/api/src/routes/org.py**

  ```python
  from fastapi import APIRouter, Depends
  from sqlalchemy.ext.asyncio import AsyncSession

  from src.auth import CurrentUser, get_current_user
  from src.database import get_session
  from src.models.package import PackageRead
  from src.models.user import OrgMemberRead
  from src.services import org_service

  router = APIRouter(tags=["org"])


  @router.get("/org/members", response_model=list[OrgMemberRead])
  async def list_org_members(
      current_user: CurrentUser = Depends(get_current_user),
      session: AsyncSession = Depends(get_session),
  ):
      """List all members of the current user's organisation with their roles."""
      if current_user.org_id is None:
          return []
      return await org_service.list_members(session, current_user.org_id)


  @router.get("/org/subscriptions", response_model=list[PackageRead])
  async def list_org_subscribed_packages(
      current_user: CurrentUser = Depends(get_current_user),
      session: AsyncSession = Depends(get_session),
  ):
      """List packages available to the current user's org (public + active private subscriptions)."""
      if current_user.org_id is None:
          return []
      return await org_service.list_subscribed_packages(session, current_user.org_id)
  ```

- [ ] **Step 8: Register org router in main.py**

  In `apps/api/src/main.py`, add the import alongside existing route imports:

  ```python
  from src.routes import (
      org as org_router,
  )
  ```

  Then add after the existing `app.include_router(admin_router.router, prefix="/api/v1")` line:

  ```python
  app.include_router(org_router.router, prefix="/api/v1")
  ```

- [ ] **Step 9: Run tests**

  ```bash
  just test-api -k "test_org_api or test_list_org"
  ```

  Expected: all PASS. Then: `just test-api`.

- [ ] **Step 10: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add GET /org/members and GET /org/subscriptions endpoints
  ```
  Then: `git add apps/api/src/models/user.py apps/api/src/repositories/user_repo.py apps/api/src/repositories/package_repo.py apps/api/src/services/org_service.py apps/api/src/routes/org.py apps/api/src/main.py apps/api/tests/test_org_api.py`

---

## Task 6: Admin package list/create + admin collections list

**Files:**
- Modify: `apps/api/src/routes/admin.py`
- Modify: `apps/api/src/services/admin_service.py`
- Possibly modify: `apps/api/src/repositories/collection_repo.py` (add `get_all`)
- Test: `apps/api/tests/test_admin_api.py`

- [ ] **Step 1: Write failing tests**

  Add to `apps/api/tests/test_admin_api.py`:

  ```python
  async def test_admin_list_packages_requires_superuser(client, regular_user):
      response = await client.get("/api/v1/admin/packages")
      assert response.status_code == 403


  async def test_admin_list_packages_returns_all(client, superuser, seed_package):
      response = await client.get("/api/v1/admin/packages")
      assert response.status_code == 200
      ids = [p["id"] for p in response.json()]
      assert seed_package.id in ids


  async def test_admin_create_package(client, superuser):
      response = await client.post(
          "/api/v1/admin/packages",
          json={"name": "Test Package", "description": "A test"},
      )
      assert response.status_code == 201
      data = response.json()
      assert data["name"] == "Test Package"
      assert data["slug"] == "test-package"


  async def test_admin_list_collections_requires_superuser(client, regular_user):
      response = await client.get("/api/v1/admin/collections")
      assert response.status_code == 403
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  just test-api -k "test_admin_list_packages or test_admin_create_package or test_admin_list_collections"
  ```

  Expected: FAIL.

- [ ] **Step 3: Check if PackageCreate model exists in models/package.py**

  Read `apps/api/src/models/package.py`. If `PackageCreate` is missing, add:

  ```python
  class PackageCreate(SQLModel):
      name: str
      slug: str | None = None
      description: str | None = None
  ```

- [ ] **Step 4: Check if collection_repo.get_all exists**

  Read `apps/api/src/repositories/collection_repo.py`. If `get_all` is missing, append:

  ```python
  async def get_all(session: AsyncSession) -> list[Collection]:
      result = await session.execute(select(Collection))
      return list(result.scalars().all())
  ```

- [ ] **Step 5: Add service functions to admin_service.py**

  Add imports at top (adjust if already imported):

  ```python
  from src.models.collection import CollectionRead
  from src.models.package import PackageCreate, PackageRead, PackageVisibility
  from src.repositories import collection_repo, package_repo
  ```

  Append functions:

  ```python
  async def list_packages(session: AsyncSession) -> list[PackageRead]:
      pkgs = await package_repo.get_all(session)
      return [
          PackageRead(
              id=cast(int, p.id),
              name=p.name,
              slug=p.slug,
              description=p.description,
              visibility=p.visibility,
              created_at=p.created_at,
          )
          for p in pkgs
      ]


  async def create_package(session: AsyncSession, body: PackageCreate) -> PackageRead:
      from slugify import slugify

      slug = body.slug or slugify(body.name)
      pkg = await package_repo.create_package(
          session, name=body.name, slug=slug, description=body.description
      )
      return PackageRead(
          id=cast(int, pkg.id),
          name=pkg.name,
          slug=pkg.slug,
          description=pkg.description,
          visibility=pkg.visibility,
          created_at=pkg.created_at,
      )


  async def list_collections(session: AsyncSession) -> list[CollectionRead]:
      cols = await collection_repo.get_all(session)
      return [
          CollectionRead(
              id=cast(int, c.id),
              name=c.name,
              slug=c.slug,
              description=c.description,
              collection_type=c.collection_type,
              created_at=c.created_at,
          )
          for c in cols
      ]
  ```

  Check the `CollectionRead` field names against `apps/api/src/models/collection.py` before writing.

- [ ] **Step 6: Add routes to admin.py**

  Add imports at the top of `apps/api/src/routes/admin.py`:

  ```python
  from src.models.collection import CollectionRead
  from src.models.package import PackageCreate, PackageRead, PackageVisibility
  ```

  Append routes (before the `PackageUpdate` class and `update_package` route, to keep related routes together):

  ```python
  @router.get("/admin/packages", response_model=list[PackageRead])
  async def list_all_packages(
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """List all packages (super-user only)."""
      return await admin_service.list_packages(session)


  @router.post("/admin/packages", response_model=PackageRead, status_code=201)
  async def create_package(
      body: PackageCreate,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """Create a new package (super-user only)."""
      return await admin_service.create_package(session, body)


  @router.get("/admin/collections", response_model=list[CollectionRead])
  async def list_all_collections(
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """List all collections (super-user only)."""
      return await admin_service.list_collections(session)
  ```

- [ ] **Step 7: Run tests**

  ```bash
  just test-api -k "test_admin_list_packages or test_admin_create_package or test_admin_list_collections"
  ```

  Expected: PASS. Then: `just test-api`.

- [ ] **Step 8: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add admin GET/POST /packages and GET /collections routes
  ```
  Then: `git add apps/api/src/routes/admin.py apps/api/src/services/admin_service.py apps/api/src/repositories/collection_repo.py apps/api/src/models/package.py apps/api/tests/test_admin_api.py`

---

## Task 7: Admin package-collection CRUD routes

**Files:**
- Modify: `apps/api/src/models/group.py` — add `PackageCollectionDetail` + request body models
- Modify: `apps/api/src/repositories/admin_repo.py` — add collection CRUD functions
- Modify: `apps/api/src/services/admin_service.py` — add service functions
- Modify: `apps/api/src/routes/admin.py` — add routes
- Create: `apps/api/tests/test_package_collection_admin.py`

- [ ] **Step 1: Write failing tests**

  Create `apps/api/tests/test_package_collection_admin.py`:

  ```python
  import pytest
  from httpx import AsyncClient

  from src.auth import CurrentUser, get_current_user
  from src.main import app


  @pytest.fixture(autouse=True)
  def as_superuser():
      app.dependency_overrides[get_current_user] = lambda: CurrentUser(
          clerk_id="super", email="super@example.com", org_id=None, is_superuser=True
      )
      yield
      app.dependency_overrides.pop(get_current_user, None)


  async def test_list_package_collections_empty(client, seed_package):
      response = await client.get(f"/api/v1/admin/packages/{seed_package.id}/collections")
      assert response.status_code == 200
      assert response.json() == []


  async def test_add_collection_to_package(client, seed_package, seed_collection):
      response = await client.post(
          f"/api/v1/admin/packages/{seed_package.id}/collections",
          json={"collection_id": seed_collection.id, "scope": "all"},
      )
      assert response.status_code == 201
      data = response.json()
      assert data["collection_id"] == seed_collection.id
      assert data["scope"] == "all"


  async def test_update_collection_scope(client, seed_package, seed_collection, seed_package_collection):
      # seed_package_collection: PackageCollection row linking seed_package + seed_collection
      response = await client.patch(
          f"/api/v1/admin/packages/{seed_package.id}/collections/{seed_collection.id}",
          json={"scope": "selected"},
      )
      assert response.status_code == 200
      assert response.json()["scope"] == "selected"


  async def test_remove_collection_from_package(client, seed_package, seed_collection, seed_package_collection):
      response = await client.delete(
          f"/api/v1/admin/packages/{seed_package.id}/collections/{seed_collection.id}"
      )
      assert response.status_code == 204
      # Verify gone
      list_response = await client.get(f"/api/v1/admin/packages/{seed_package.id}/collections")
      ids = [c["collection_id"] for c in list_response.json()]
      assert seed_collection.id not in ids


  async def test_add_and_remove_dataset_inclusion(client, seed_package, seed_collection, seed_dataset, seed_package_collection_selected):
      # seed_package_collection_selected: PackageCollection with scope=selected
      add_resp = await client.post(
          f"/api/v1/admin/packages/{seed_package.id}/collections/{seed_collection.id}/datasets",
          json={"dataset_id": seed_dataset.id},
      )
      assert add_resp.status_code == 201

      detail_resp = await client.get(f"/api/v1/admin/packages/{seed_package.id}/collections")
      detail = next(c for c in detail_resp.json() if c["collection_id"] == seed_collection.id)
      assert seed_dataset.id in detail["dataset_ids"]

      del_resp = await client.delete(
          f"/api/v1/admin/packages/{seed_package.id}/collections/{seed_collection.id}/datasets/{seed_dataset.id}"
      )
      assert del_resp.status_code == 204
  ```

- [ ] **Step 2: Run tests to verify they fail**

  ```bash
  just test-api -k "test_package_collection_admin"
  ```

  Expected: FAIL.

- [ ] **Step 3: Add schemas to models/group.py**

  Append to `apps/api/src/models/group.py`:

  ```python
  class PackageCollectionDetail(SQLModel):
      package_id: int
      collection_id: int
      scope: PackageCollectionScope
      collection_name: str
      collection_slug: str
      collection_type: str
      dataset_ids: list[int]


  class AddCollectionBody(SQLModel):
      collection_id: int
      scope: PackageCollectionScope = PackageCollectionScope.all


  class UpdateScopeBody(SQLModel):
      scope: PackageCollectionScope


  class AddDatasetBody(SQLModel):
      dataset_id: int
  ```

- [ ] **Step 4: Add repo functions to admin_repo.py**

  Append to `apps/api/src/repositories/admin_repo.py`:

  ```python
  async def get_package_collections(
      session: AsyncSession, package_id: int
  ) -> list[tuple]:
      """Return (PackageCollection, collection_name, collection_slug, collection_type, [dataset_ids]) tuples."""
      from src.models.collection import Collection
      from src.models.group import PackageCollection, PackageCollectionDataset

      pcs = list(
          (
              await session.execute(
                  select(PackageCollection).where(PackageCollection.package_id == package_id)
              )
          )
          .scalars()
          .all()
      )
      result = []
      for pc in pcs:
          col = await session.get(Collection, pc.collection_id)
          ds_ids = list(
              (
                  await session.execute(
                      select(PackageCollectionDataset.dataset_id).where(
                          PackageCollectionDataset.package_id == package_id,
                          PackageCollectionDataset.collection_id == pc.collection_id,
                      )
                  )
              )
              .scalars()
              .all()
          )
          result.append((pc, col, ds_ids))
      return result


  async def add_collection_to_package(
      session: AsyncSession,
      *,
      package_id: int,
      collection_id: int,
      scope: "PackageCollectionScope",
  ) -> "PackageCollection":
      from src.models.group import PackageCollection

      pc = PackageCollection(
          package_id=package_id,
          collection_id=collection_id,
          scope=scope,
      )
      session.add(pc)
      await session.flush()
      await session.refresh(pc)
      return pc


  async def update_collection_scope(
      session: AsyncSession,
      *,
      package_id: int,
      collection_id: int,
      scope: "PackageCollectionScope",
  ) -> "PackageCollection | None":
      from src.models.group import PackageCollection

      pc = await session.get(PackageCollection, (package_id, collection_id))
      if pc is None:
          return None
      pc.scope = scope
      await session.flush()
      await session.refresh(pc)
      return pc


  async def remove_collection_from_package(
      session: AsyncSession, *, package_id: int, collection_id: int
  ) -> None:
      from sqlalchemy import delete

      from src.models.group import PackageCollection

      await session.execute(
          delete(PackageCollection).where(
              PackageCollection.package_id == package_id,
              PackageCollection.collection_id == collection_id,
          )
      )
      await session.flush()


  async def add_dataset_inclusion(
      session: AsyncSession,
      *,
      package_id: int,
      collection_id: int,
      dataset_id: int,
  ) -> None:
      from src.models.group import PackageCollectionDataset

      pcd = PackageCollectionDataset(
          package_id=package_id,
          collection_id=collection_id,
          dataset_id=dataset_id,
      )
      session.add(pcd)
      await session.flush()


  async def remove_dataset_inclusion(
      session: AsyncSession,
      *,
      package_id: int,
      collection_id: int,
      dataset_id: int,
  ) -> None:
      from sqlalchemy import delete

      from src.models.group import PackageCollectionDataset

      await session.execute(
          delete(PackageCollectionDataset).where(
              PackageCollectionDataset.package_id == package_id,
              PackageCollectionDataset.collection_id == collection_id,
              PackageCollectionDataset.dataset_id == dataset_id,
          )
      )
      await session.flush()
  ```

- [ ] **Step 5: Add service functions to admin_service.py**

  Add imports:

  ```python
  from src.models.group import (
      PackageCollectionDetail,
      PackageCollectionScope,
  )
  ```

  Append functions:

  ```python
  async def list_package_collections(
      session: AsyncSession, package_id: int
  ) -> list[PackageCollectionDetail]:
      rows = await admin_repo.get_package_collections(session, package_id)
      result = []
      for pc, col, ds_ids in rows:
          result.append(
              PackageCollectionDetail(
                  package_id=pc.package_id,
                  collection_id=pc.collection_id,
                  scope=pc.scope,
                  collection_name=col.name if col else "",
                  collection_slug=col.slug if col else "",
                  collection_type=str(col.collection_type) if col else "",
                  dataset_ids=ds_ids,
              )
          )
      return result


  async def add_collection_to_package(
      session: AsyncSession,
      *,
      package_id: int,
      collection_id: int,
      scope: PackageCollectionScope,
  ) -> PackageCollectionDetail:
      from src.repositories import collection_repo

      pc = await admin_repo.add_collection_to_package(
          session, package_id=package_id, collection_id=collection_id, scope=scope
      )
      col = await collection_repo.get_by_id(session, collection_id)
      return PackageCollectionDetail(
          package_id=pc.package_id,
          collection_id=pc.collection_id,
          scope=pc.scope,
          collection_name=col.name if col else "",
          collection_slug=col.slug if col else "",
          collection_type=str(col.collection_type) if col else "",
          dataset_ids=[],
      )


  async def update_collection_scope(
      session: AsyncSession,
      *,
      package_id: int,
      collection_id: int,
      scope: PackageCollectionScope,
  ) -> PackageCollectionDetail:
      from sqlalchemy import select

      from src.models.group import PackageCollectionDataset
      from src.repositories import collection_repo

      pc = await admin_repo.update_collection_scope(
          session, package_id=package_id, collection_id=collection_id, scope=scope
      )
      if pc is None:
          raise PackageNotFoundError(package_id)
      col = await collection_repo.get_by_id(session, collection_id)
      ds_ids = list(
          (
              await session.execute(
                  select(PackageCollectionDataset.dataset_id).where(
                      PackageCollectionDataset.package_id == package_id,
                      PackageCollectionDataset.collection_id == collection_id,
                  )
              )
          )
          .scalars()
          .all()
      )
      return PackageCollectionDetail(
          package_id=pc.package_id,
          collection_id=pc.collection_id,
          scope=pc.scope,
          collection_name=col.name if col else "",
          collection_slug=col.slug if col else "",
          collection_type=str(col.collection_type) if col else "",
          dataset_ids=ds_ids,
      )


  async def remove_collection_from_package(
      session: AsyncSession, *, package_id: int, collection_id: int
  ) -> None:
      await admin_repo.remove_collection_from_package(
          session, package_id=package_id, collection_id=collection_id
      )


  async def add_dataset_inclusion(
      session: AsyncSession, *, package_id: int, collection_id: int, dataset_id: int
  ) -> None:
      await admin_repo.add_dataset_inclusion(
          session, package_id=package_id, collection_id=collection_id, dataset_id=dataset_id
      )


  async def remove_dataset_inclusion(
      session: AsyncSession, *, package_id: int, collection_id: int, dataset_id: int
  ) -> None:
      await admin_repo.remove_dataset_inclusion(
          session, package_id=package_id, collection_id=collection_id, dataset_id=dataset_id
      )
  ```

- [ ] **Step 6: Add routes to admin.py**

  Add imports:

  ```python
  from src.models.group import (
      AddCollectionBody,
      AddDatasetBody,
      PackageCollectionDetail,
      PackageCollectionScope,
      UpdateScopeBody,
  )
  ```

  Append routes after the existing `update_package` route:

  ```python
  @router.get(
      "/admin/packages/{package_id}/collections",
      response_model=list[PackageCollectionDetail],
  )
  async def list_package_collections(
      package_id: int,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """List collections included in a package with their scope and dataset inclusions."""
      return await admin_service.list_package_collections(session, package_id)


  @router.post(
      "/admin/packages/{package_id}/collections",
      response_model=PackageCollectionDetail,
      status_code=201,
  )
  async def add_collection_to_package(
      package_id: int,
      body: AddCollectionBody,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """Add a collection to a package."""
      return await admin_service.add_collection_to_package(
          session,
          package_id=package_id,
          collection_id=body.collection_id,
          scope=body.scope,
      )


  @router.patch(
      "/admin/packages/{package_id}/collections/{collection_id}",
      response_model=PackageCollectionDetail,
  )
  async def update_package_collection_scope(
      package_id: int,
      collection_id: int,
      body: UpdateScopeBody,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """Update the dataset scope for a collection within a package."""
      return await admin_service.update_collection_scope(
          session,
          package_id=package_id,
          collection_id=collection_id,
          scope=body.scope,
      )


  @router.delete(
      "/admin/packages/{package_id}/collections/{collection_id}",
      response_model=None,
      status_code=204,
  )
  async def remove_collection_from_package(
      package_id: int,
      collection_id: int,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """Remove a collection from a package."""
      await admin_service.remove_collection_from_package(
          session, package_id=package_id, collection_id=collection_id
      )


  @router.post(
      "/admin/packages/{package_id}/collections/{collection_id}/datasets",
      response_model=None,
      status_code=201,
  )
  async def add_dataset_inclusion(
      package_id: int,
      collection_id: int,
      body: AddDatasetBody,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """Add a dataset to the selected-scope inclusion list for a collection."""
      await admin_service.add_dataset_inclusion(
          session,
          package_id=package_id,
          collection_id=collection_id,
          dataset_id=body.dataset_id,
      )


  @router.delete(
      "/admin/packages/{package_id}/collections/{collection_id}/datasets/{dataset_id}",
      response_model=None,
      status_code=204,
  )
  async def remove_dataset_inclusion(
      package_id: int,
      collection_id: int,
      dataset_id: int,
      _: CurrentUser = Depends(_require_superuser),
      session: AsyncSession = Depends(get_session),
  ):
      """Remove a dataset from the selected-scope inclusion list."""
      await admin_service.remove_dataset_inclusion(
          session,
          package_id=package_id,
          collection_id=collection_id,
          dataset_id=dataset_id,
      )
  ```

- [ ] **Step 7: Run tests**

  ```bash
  just test-api -k "test_package_collection_admin"
  ```

  Expected: all PASS. Then: `just test-api`.

- [ ] **Step 8: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(api): add admin package-collection CRUD and dataset inclusion endpoints
  ```
  Then: `git add apps/api/src/models/group.py apps/api/src/repositories/admin_repo.py apps/api/src/services/admin_service.py apps/api/src/routes/admin.py apps/api/tests/test_package_collection_admin.py`

---

## Task 8: Regenerate API types

**Files:**
- Auto-generated: `packages/shared/api.d.ts`

- [ ] **Step 1: Start the API server**

  ```bash
  just api
  ```

  Wait for "Application startup complete" in the output.

- [ ] **Step 2: Run generate-types**

  ```bash
  just generate-types
  ```

  Expected: `packages/shared/api.d.ts` updated. Verify it now contains `OrgMemberRead`, `PackageCollectionDetail`, `GroupMemberRead`, `GroupPackageRead`.

- [ ] **Step 3: Stop the API server** (Ctrl+C)

- [ ] **Step 4: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  chore(shared): regenerate api.d.ts with new org, group-detail, and admin package-collection types
  ```
  Then: `git add packages/shared/api.d.ts`

---

## Task 9: GroupsList — sort, pagination, delete, create modal, role gating

**Files:**
- Modify: `apps/web/src/app/org/groups/GroupsList.tsx`
- Modify: `apps/web/src/app/org/groups/GroupsPage.tsx` — track full selected group object

- [ ] **Step 1: Update GroupsPage.tsx to track the selected group object**

  Change `selectedGroupId: number | null` state to track the full group:

  ```tsx
  const [selectedGroup, setSelectedGroup] = useState<
    components["schemas"]["GroupWithCounts"] | null
  >(null);
  ```

  Pass `selectedGroupId={selectedGroup?.id ?? null}` to `GroupsList` (keep the existing `onSelect` prop shape if used by child panels — adapt as needed).

  Pass `isDefault={selectedGroup?.is_default ?? false}` and `groupId={selectedGroup?.id ?? null}` to `MembersPanel` and `PackagesPanel`.

- [ ] **Step 2: Rewrite GroupsList.tsx**

  Replace the full file content with the implementation below. Read the current file first to preserve any design token classes already used.

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { useOrganization } from "@clerk/nextjs";
  import api from "@/lib/api";
  import type { components } from "packages/shared/api";

  type GroupWithCounts = components["schemas"]["GroupWithCounts"];

  interface Props {
    selectedGroupId: number | null;
    onSelect: (group: GroupWithCounts | null) => void;
  }

  const PAGE_SIZE = 10;

  export function GroupsList({ selectedGroupId, onSelect }: Props) {
    const { membership } = useOrganization();
    const isAdmin = membership?.role === "org:admin";

    const [groups, setGroups] = useState<GroupWithCounts[]>([]);
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "member_count" | "package_count">("name");
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const fetchGroups = async () => {
      const { data } = await api.GET("/api/v1/groups");
      if (data) setGroups(data);
    };

    useEffect(() => { fetchGroups(); }, []);

    const filtered = groups
      .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) =>
        sortBy === "name"
          ? a.name.localeCompare(b.name)
          : (b[sortBy] as number) - (a[sortBy] as number)
      );
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleCreate = async () => {
      if (!newName.trim()) return;
      const { data } = await api.POST("/api/v1/groups", {
        body: { name: newName.trim() },
      });
      if (data) {
        await fetchGroups();
        setShowCreate(false);
        setNewName("");
      }
    };

    const handleDelete = async (groupId: number) => {
      await api.DELETE("/api/v1/groups/{group_id}", {
        params: { path: { group_id: groupId } },
      });
      if (selectedGroupId === groupId) onSelect(null);
      setDeletingId(null);
      await fetchGroups();
    };

    return (
      <div
        data-testid="groups-list"
        className="flex flex-col h-full border-r border-border bg-card"
      >
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search groups…"
            className="flex-1 text-sm rounded border border-border px-2 py-1 bg-background text-foreground placeholder:text-muted-foreground"
          />
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground shrink-0"
            >
              + New
            </button>
          )}
        </div>

        <div className="px-4 py-2 flex gap-2 text-xs text-muted-foreground border-b border-border">
          {(["name", "member_count", "package_count"] as const).map((key) => (
            <button
              key={key}
              onClick={() => { setSortBy(key); setPage(1); }}
              className={sortBy === key ? "text-foreground font-medium" : ""}
            >
              {key === "name" ? "Name" : key === "member_count" ? "Members" : "Packages"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {paged.map((g) => (
            <div
              key={g.id}
              data-testid="group-row"
              onClick={() => onSelect(g)}
              className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-border hover:bg-muted/50 ${
                g.id === selectedGroupId ? "bg-muted" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium text-foreground">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.member_count} members · {g.package_count} packages
                  {g.is_default && " · Default"}
                </p>
              </div>
              {isAdmin && !g.is_default && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingId(g.id); }}
                  className="text-xs text-destructive hover:underline ml-2 shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              ← Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next →
            </button>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-4 w-72">
              <h3 className="text-sm font-medium text-foreground">New Group</h3>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Group name"
                className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {deletingId !== null && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
            <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-4 w-72">
              <p className="text-sm text-foreground">Delete this group? This cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeletingId(null)} className="text-xs text-muted-foreground">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deletingId)}
                  className="text-xs px-3 py-1 rounded bg-destructive text-destructive-foreground"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  ```

  Note: `absolute` positioning for modals requires the parent container to be `relative`. Verify `GroupsPage.tsx` has `relative` on its wrapper, or use a portal. Adapt as needed.

  Also update the `onSelect` type in `GroupsPage.tsx` from `(id: number | null) => void` to `(group: GroupWithCounts | null) => void` so the panels receive the full group object.

- [ ] **Step 3: Run typecheck**

  ```bash
  just typecheck
  ```

  Fix any type errors.

- [ ] **Step 4: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): GroupsList — sort, pagination, create modal, delete, role gating
  ```
  Then: `git add apps/web/src/app/org/groups/GroupsList.tsx apps/web/src/app/org/groups/GroupsPage.tsx`

---

## Task 10: MembersPanel — full implementation

**Files:**
- Modify: `apps/web/src/app/org/groups/MembersPanel.tsx`
- Create: `apps/web/src/app/org/groups/MembersPanel.stories.tsx`

- [ ] **Step 1: Rewrite MembersPanel.tsx**

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { useOrganization } from "@clerk/nextjs";
  import api from "@/lib/api";
  import type { components } from "packages/shared/api";

  type GroupMemberRead = components["schemas"]["GroupMemberRead"];
  type OrgMemberRead = components["schemas"]["OrgMemberRead"];

  interface Props {
    groupId: number | null;
    isDefault: boolean;
  }

  export function MembersPanel({ groupId, isDefault }: Props) {
    const { membership } = useOrganization();
    const isAdmin = membership?.role === "org:admin";

    const [members, setMembers] = useState<GroupMemberRead[]>([]);
    const [orgMembers, setOrgMembers] = useState<OrgMemberRead[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchMembers = async (gid: number) => {
      const { data } = await api.GET("/api/v1/groups/{group_id}/members", {
        params: { path: { group_id: gid } },
      });
      if (data) setMembers(data);
    };

    useEffect(() => {
      if (!groupId) { setMembers([]); return; }
      setIsLoading(true);
      Promise.all([
        fetchMembers(groupId),
        api.GET("/api/v1/org/members").then(({ data }) => { if (data) setOrgMembers(data); }),
      ]).finally(() => setIsLoading(false));
    }, [groupId]);

    const handleAdd = async (userId: number) => {
      if (!groupId) return;
      await api.POST("/api/v1/groups/{group_id}/members", {
        params: { path: { group_id: groupId } },
        body: { user_id: userId },
      });
      await fetchMembers(groupId);
      setShowAdd(false);
    };

    const handleRemove = async (userId: number) => {
      if (!groupId) return;
      await api.DELETE("/api/v1/groups/{group_id}/members/{user_id}", {
        params: { path: { group_id: groupId, user_id: userId } },
      });
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    };

    if (!groupId) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Select a group to manage members
        </div>
      );
    }

    const memberUserIds = new Set(members.map((m) => m.user_id));
    const addable = orgMembers.filter((m) => !memberUserIds.has(m.user_id));

    return (
      <div className="flex flex-col h-full bg-card border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Members</h3>
          {isAdmin && !isDefault && (
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="text-xs px-2 py-1 rounded bg-muted text-foreground hover:bg-muted/70"
            >
              + Add
            </button>
          )}
        </div>

        {showAdd && (
          <div
            data-testid="add-member-panel"
            className="border-b border-border px-4 py-3 flex flex-col gap-1 bg-muted/30"
          >
            <p className="text-xs text-muted-foreground mb-1">Select org member to add:</p>
            {addable.length === 0 ? (
              <p className="text-xs text-muted-foreground">All members already in this group</p>
            ) : (
              addable.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => handleAdd(m.user_id)}
                  className="text-left text-sm text-foreground hover:text-primary py-0.5"
                >
                  {m.email}{" "}
                  <span className="text-xs text-muted-foreground capitalize">({m.role})</span>
                </button>
              ))
            )}
            <button onClick={() => setShowAdd(false)} className="text-xs text-muted-foreground mt-1">
              Cancel
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground px-4 py-3">Loading…</p>
          )}
          {!isLoading && members.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-3">No members yet</p>
          )}
          {members.map((m) => (
            <div
              key={m.user_id}
              data-testid="member-row"
              className="flex items-center justify-between px-4 py-3 border-b border-border"
            >
              <div>
                <p className="text-sm text-foreground">{m.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
              </div>
              {isAdmin && !isDefault && (
                <button
                  onClick={() => handleRemove(m.user_id)}
                  className="text-xs text-destructive hover:underline shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {isDefault && (
            <p className="text-xs text-muted-foreground px-4 py-2">
              Default group membership is managed automatically
            </p>
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create MembersPanel.stories.tsx**

  ```tsx
  import type { Meta, StoryObj } from "@storybook/react";
  import { MembersPanel } from "./MembersPanel";

  const meta: Meta<typeof MembersPanel> = {
    component: MembersPanel,
    title: "Org/Groups/MembersPanel",
  };
  export default meta;
  type Story = StoryObj<typeof MembersPanel>;

  export const NoGroupSelected: Story = {
    args: { groupId: null, isDefault: false },
  };

  export const DefaultGroup: Story = {
    args: { groupId: 1, isDefault: true },
  };

  export const AdminView: Story = {
    args: { groupId: 2, isDefault: false },
  };
  ```

  Wire MSW handlers in `preview.ts` following the existing Storybook MSW pattern in this codebase (check `apps/web/.storybook/preview.ts` for the pattern).

- [ ] **Step 3: Typecheck and lint**

  ```bash
  just typecheck
  just lint
  ```

- [ ] **Step 4: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): implement MembersPanel for /org/groups with add/remove and role gating
  ```
  Then: `git add apps/web/src/app/org/groups/MembersPanel.tsx apps/web/src/app/org/groups/MembersPanel.stories.tsx`

---

## Task 11: PackagesPanel — full implementation

**Files:**
- Modify: `apps/web/src/app/org/groups/PackagesPanel.tsx`
- Create: `apps/web/src/app/org/groups/PackagesPanel.stories.tsx`

- [ ] **Step 1: Rewrite PackagesPanel.tsx**

  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { useOrganization } from "@clerk/nextjs";
  import api from "@/lib/api";
  import type { components } from "packages/shared/api";

  type PackageRead = components["schemas"]["PackageRead"];
  type GroupPackageRead = components["schemas"]["GroupPackageRead"];

  interface Props {
    groupId: number | null;
  }

  export function PackagesPanel({ groupId }: Props) {
    const { membership } = useOrganization();
    const isAdmin = membership?.role === "org:admin";

    const [orgPackages, setOrgPackages] = useState<PackageRead[]>([]);
    const [groupPackageIds, setGroupPackageIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
      api.GET("/api/v1/org/subscriptions").then(({ data }) => {
        if (data) setOrgPackages(data);
      });
    }, []);

    useEffect(() => {
      if (!groupId) { setGroupPackageIds(new Set()); return; }
      setIsLoading(true);
      api
        .GET("/api/v1/groups/{group_id}/packages", {
          params: { path: { group_id: groupId } },
        })
        .then(({ data }) => {
          if (data) setGroupPackageIds(new Set((data as GroupPackageRead[]).map((p) => p.package_id)));
        })
        .finally(() => setIsLoading(false));
    }, [groupId]);

    const togglePackage = async (packageId: number) => {
      if (!groupId) return;
      if (groupPackageIds.has(packageId)) {
        await api.DELETE("/api/v1/groups/{group_id}/packages/{package_id}", {
          params: { path: { group_id: groupId, package_id: packageId } },
        });
        setGroupPackageIds((prev) => {
          const s = new Set(prev);
          s.delete(packageId);
          return s;
        });
      } else {
        await api.POST("/api/v1/groups/{group_id}/packages", {
          params: { path: { group_id: groupId } },
          body: { package_id: packageId },
        });
        setGroupPackageIds((prev) => new Set([...prev, packageId]));
      }
    };

    if (!groupId) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          Select a group to view packages
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Package Access</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <p className="text-sm text-muted-foreground px-4 py-3">Loading…</p>
          )}
          {!isLoading && orgPackages.length === 0 && (
            <p className="text-sm text-muted-foreground px-4 py-3">
              No packages available for this org
            </p>
          )}
          {orgPackages.map((pkg) => {
            const granted = groupPackageIds.has(pkg.id);
            return (
              <div
                key={pkg.id}
                data-testid="package-row"
                className="flex items-center justify-between px-4 py-3 border-b border-border"
              >
                <div>
                  <p className="text-sm text-foreground">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{pkg.visibility}</p>
                </div>
                {isAdmin ? (
                  <button
                    onClick={() => togglePackage(pkg.id)}
                    className={`text-xs px-2 py-1 rounded shrink-0 ${
                      granted
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {granted ? "Granted" : "Grant"}
                  </button>
                ) : (
                  <span
                    className={`text-xs px-2 py-1 rounded shrink-0 ${
                      granted ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {granted ? "Granted" : "No access"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Create PackagesPanel.stories.tsx**

  ```tsx
  import type { Meta, StoryObj } from "@storybook/react";
  import { PackagesPanel } from "./PackagesPanel";

  const meta: Meta<typeof PackagesPanel> = {
    component: PackagesPanel,
    title: "Org/Groups/PackagesPanel",
  };
  export default meta;
  type Story = StoryObj<typeof PackagesPanel>;

  export const NoGroupSelected: Story = {
    args: { groupId: null },
  };

  export const WithGroup: Story = {
    args: { groupId: 1 },
  };
  ```

- [ ] **Step 3: Typecheck and lint**

  ```bash
  just typecheck
  just lint
  ```

- [ ] **Step 4: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): implement PackagesPanel for /org/groups with grant/revoke toggle
  ```
  Then: `git add apps/web/src/app/org/groups/PackagesPanel.tsx apps/web/src/app/org/groups/PackagesPanel.stories.tsx`

---

## Task 12: Admin PackagesTab — implement PackageCompositionPanel

**Files:**
- Modify: `apps/web/src/app/admin/PackagesTab.tsx`

- [ ] **Step 1: Read PackagesTab.tsx in full before editing**

  Locate the `PackageCompositionPanel` nested component (currently shows "coming soon" placeholder). Note the exact props it receives (currently just `packageId: number` based on the audit).

- [ ] **Step 2: Replace PackageCompositionPanel with full implementation**

  Replace the placeholder component body. Keep all import statements and the outer `PackagesTab` component unchanged. Only replace `PackageCompositionPanel`:

  ```tsx
  type PackageCollectionDetail = components["schemas"]["PackageCollectionDetail"];
  type CollectionRead = components["schemas"]["CollectionRead"];
  type DatasetRead = components["schemas"]["DatasetListPage"]["items"][number];

  function PackageCompositionPanel({ packageId }: { packageId: number }) {
    const [linked, setLinked] = useState<PackageCollectionDetail[]>([]);
    const [allCols, setAllCols] = useState<CollectionRead[]>([]);
    const [colDatasets, setColDatasets] = useState<Record<number, DatasetRead[]>>({});
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
      setIsLoading(true);
      const [linkedRes, allColsRes] = await Promise.all([
        api.GET("/api/v1/admin/packages/{package_id}/collections", {
          params: { path: { package_id: packageId } },
        }),
        api.GET("/api/v1/admin/collections"),
      ]);
      if (linkedRes.data) setLinked(linkedRes.data);
      if (allColsRes.data) setAllCols(allColsRes.data);
      setIsLoading(false);
    };

    useEffect(() => { fetchData(); }, [packageId]);

    const fetchColDatasets = async (collectionId: number) => {
      if (colDatasets[collectionId]) return;
      const { data } = await api.GET("/api/v1/datasets", {
        params: { query: { collection_id: collectionId } },
      });
      if (data) setColDatasets((prev) => ({ ...prev, [collectionId]: data.items }));
    };

    const toggleCollection = async (colId: number, included: boolean) => {
      if (included) {
        await api.DELETE(
          "/api/v1/admin/packages/{package_id}/collections/{collection_id}",
          { params: { path: { package_id: packageId, collection_id: colId } } }
        );
        setLinked((prev) => prev.filter((c) => c.collection_id !== colId));
      } else {
        const { data } = await api.POST(
          "/api/v1/admin/packages/{package_id}/collections",
          {
            params: { path: { package_id: packageId } },
            body: { collection_id: colId, scope: "all" },
          }
        );
        if (data) setLinked((prev) => [...prev, data]);
      }
    };

    const updateScope = async (colId: number, scope: "all" | "selected") => {
      const { data } = await api.PATCH(
        "/api/v1/admin/packages/{package_id}/collections/{collection_id}",
        {
          params: { path: { package_id: packageId, collection_id: colId } },
          body: { scope },
        }
      );
      if (data) {
        setLinked((prev) => prev.map((c) => (c.collection_id === colId ? data : c)));
        if (scope === "selected") fetchColDatasets(colId);
      }
    };

    const toggleDataset = async (colId: number, datasetId: number, included: boolean) => {
      if (included) {
        await api.DELETE(
          "/api/v1/admin/packages/{package_id}/collections/{collection_id}/datasets/{dataset_id}",
          {
            params: {
              path: { package_id: packageId, collection_id: colId, dataset_id: datasetId },
            },
          }
        );
      } else {
        await api.POST(
          "/api/v1/admin/packages/{package_id}/collections/{collection_id}/datasets",
          {
            params: { path: { package_id: packageId, collection_id: colId } },
            body: { dataset_id: datasetId },
          }
        );
      }
      // Refresh linked to update dataset_ids
      const { data } = await api.GET("/api/v1/admin/packages/{package_id}/collections", {
        params: { path: { package_id: packageId } },
      });
      if (data) setLinked(data);
    };

    const linkedIds = new Set(linked.map((c) => c.collection_id));

    if (isLoading) {
      return <p className="text-sm text-muted-foreground p-4">Loading…</p>;
    }

    return (
      <div data-testid="package-composition-panel" className="flex flex-col gap-4 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-foreground">Collections</h3>
        {allCols.length === 0 && (
          <p className="text-sm text-muted-foreground">No collections exist yet</p>
        )}
        {allCols.map((col) => {
          const included = linkedIds.has(col.id);
          const detail = linked.find((c) => c.collection_id === col.id);
          const datasets = colDatasets[col.id] ?? [];

          return (
            <div
              key={col.id}
              data-testid="collection-row"
              className="border border-border rounded-lg p-3 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{col.name}</p>
                  <p className="text-xs text-muted-foreground">{col.collection_type}</p>
                </div>
                <button
                  onClick={() => toggleCollection(col.id, included)}
                  className={`text-xs px-2 py-1 rounded shrink-0 ${
                    included
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {included ? "Included" : "Include"}
                </button>
              </div>

              {included && detail && (
                <div className="pl-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Scope:</label>
                    <select
                      value={detail.scope}
                      onChange={(e) => updateScope(col.id, e.target.value as "all" | "selected")}
                      className="text-xs border border-border rounded px-1 py-0.5 bg-background text-foreground"
                    >
                      <option value="all">All datasets</option>
                      <option value="selected">Selected datasets</option>
                    </select>
                  </div>

                  {detail.scope === "selected" && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">Datasets:</p>
                      {datasets.length === 0 && (
                        <button
                          onClick={() => fetchColDatasets(col.id)}
                          className="text-xs text-primary hover:underline text-left"
                        >
                          Load datasets
                        </button>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {datasets.map((ds) => {
                          const dsIncluded = detail.dataset_ids.includes(ds.id);
                          return (
                            <button
                              key={ds.id}
                              onClick={() => toggleDataset(col.id, ds.id, dsIncluded)}
                              className={`text-xs px-2 py-0.5 rounded-full border ${
                                dsIncluded
                                  ? "border-primary text-primary bg-primary/5"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {ds.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  ```

  Ensure `useState`, `useEffect` are imported. The types `CollectionRead`, `PackageCollectionDetail` come from `components["schemas"]` in `packages/shared/api.d.ts` (generated in Task 8).

  Also update the `PackagesTab` component to call `GET /api/v1/admin/packages` instead of `GET /api/v1/packages` for the package list, so visibility filter works correctly for superusers:

  ```tsx
  // Change from:
  api.GET("/api/v1/packages")
  // To:
  api.GET("/api/v1/admin/packages")
  ```

- [ ] **Step 3: Typecheck and lint**

  ```bash
  just typecheck
  just lint
  ```

  Fix any type errors — particularly around the `PackageCollectionDetail` shape (check that field names match what `just generate-types` produced in Task 8).

- [ ] **Step 4: Commit**

  Write to `/tmp/commit-msg.txt`:
  ```
  feat(web): implement admin PackagesTab composition panel with collection/dataset CRUD
  ```
  Then: `git add apps/web/src/app/admin/PackagesTab.tsx`

---

## Task 13: Final checks

- [ ] **Step 1: Run full test suite**

  ```bash
  just test
  ```

  Expected: all tests PASS.

- [ ] **Step 2: Lint and format check**

  ```bash
  just lint
  just format-check
  ```

  Fix any issues with `just lint-fix` and `just format`.

- [ ] **Step 3: Typecheck**

  ```bash
  just typecheck
  ```

- [ ] **Step 4: Start dev server and spot-check the UI**

  ```bash
  just dev
  ```

  Verify:
  - `/org/groups` — GroupsList shows sort controls, pagination, create/delete buttons (for admin); MembersPanel loads members; PackagesPanel loads and toggles work
  - `/admin` — PackagesTab shows packages list; selecting a package shows the composition panel with collections and Include toggles

- [ ] **Step 5: Final commit if any formatting fixes were needed**

  Write to `/tmp/commit-msg.txt`:
  ```
  chore: lint and format fixes after Phase 2 gap fill
  ```
