# AuthN & AuthZ Phase 2 — Access Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Your first step is to Read CLAUDE.md.**
>
> **CRITICAL RULES (from CLAUDE.md):**
> 1. Always use `just <cmd>` from repo root — never cd into subdirs
> 2. Never start a Bash call with a `#` comment
> 3. `git add` and `git commit` must be separate Bash calls; write message to `/tmp/commit-msg.txt` then `git commit -F /tmp/commit-msg.txt`
> 4. Never edit `packages/shared/api.d.ts` manually — run `just generate-types`
> 5. Before implementing any frontend component, invoke the `frontend-design` skill
> 6. No raw hex colors, no `text-primary` as text color, no `dark:` overrides

**Goal:** Add group-based package access control — public/private packages, org subscriptions, group memberships, and admin UI.

**Architecture:** A `get_accessible_package_ids` FastAPI dependency resolves what packages a user can see (public always; private only when org subscribed + in an authorised group). Routes inject this dependency; services filter on it. Two new frontend pages: `/org/groups` for org admins and `/admin` for super-users.

**Tech Stack:** FastAPI + SQLModel + asyncpg, SQLAlchemy async, Alembic, Next.js 15 App Router, openapi-fetch, shadcn/ui, Storybook, Clerk

**Spec:** `docs/superpowers/specs/2026-04-21-authn-authz-phase2-design.md`

---

## File Map

### New backend files
- `apps/api/src/models/group.py` — Group, GroupMembership, GroupPackage, OrgSubscription, PackageCollection, PackageCollectionDataset models + read schemas
- `apps/api/src/repositories/group_repo.py` — group/membership CRUD, default group helpers
- `apps/api/src/repositories/admin_repo.py` — org listing, subscription CRUD, package composition CRUD
- `apps/api/src/services/group_service.py` — group management business logic
- `apps/api/src/services/admin_service.py` — admin business logic
- `apps/api/src/routes/groups.py` — group management endpoints
- `apps/api/src/routes/admin.py` — admin endpoints
- `apps/api/tests/test_access_control.py` — get_accessible_package_ids unit tests
- `apps/api/tests/test_groups_api.py` — group route tests
- `apps/api/tests/test_admin_api.py` — admin route tests

### Modified backend files
- `apps/api/src/models/package.py` — add `visibility` field, add `PackageVisibility` enum, update `PackageRead`
- `apps/api/src/models/collection.py` — remove `package_id` FK from `CollectionBase`
- `apps/api/src/models/__init__.py` — add new model exports
- `apps/api/migrations/env.py` — add new model imports
- `apps/api/src/auth.py` — add `is_superuser` to `CurrentUser`, add `get_accessible_package_ids` dependency
- `apps/api/src/config.py` — add `dev_superuser: bool = False`
- `apps/api/src/repositories/package_repo.py` — replace `get_collections_for_package` (uses old FK), add `get_accessible_ids`
- `apps/api/src/repositories/collection_repo.py` — replace `get_all_for_packages` (uses old FK)
- `apps/api/src/services/package_service.py` — update `get_scope` and `get_with_collections` for new join table
- `apps/api/src/services/user_service.py` — add default-group creation/deletion to webhook handler
- `apps/api/src/routes/packages.py` — add auth + accessible_ids
- `apps/api/src/routes/analytics.py` — add auth + accessible_ids + input validation
- `apps/api/src/routes/ai.py` — add auth + accessible_ids
- `apps/api/src/routes/collections.py` — add auth
- `apps/api/src/routes/datasets.py` — add auth
- `apps/api/src/main.py` — register groups and admin routers
- `apps/api/tests/conftest.py` — update `bare_dataset`/`seeded_collection` fixtures (remove `package_id`, add `PackageCollection` row)

### New frontend files
- `apps/web/src/app/org/groups/page.tsx` — thin Next.js page shell
- `apps/web/src/app/org/groups/GroupsPage.tsx` — three-panel layout component
- `apps/web/src/app/org/groups/GroupsPage.stories.tsx`
- `apps/web/src/app/org/groups/GroupsList.tsx` — groups list panel
- `apps/web/src/app/org/groups/GroupsList.stories.tsx`
- `apps/web/src/app/org/groups/MembersPanel.tsx` — members panel
- `apps/web/src/app/org/groups/MembersPanel.stories.tsx`
- `apps/web/src/app/org/groups/PackagesPanel.tsx` — packages panel
- `apps/web/src/app/org/groups/PackagesPanel.stories.tsx`
- `apps/web/src/app/admin/page.tsx` — thin Next.js page shell
- `apps/web/src/app/admin/AdminPage.tsx` — two-tab admin layout
- `apps/web/src/app/admin/AdminPage.stories.tsx`
- `apps/web/src/app/admin/SubscriptionsTab.tsx`
- `apps/web/src/app/admin/SubscriptionsTab.stories.tsx`
- `apps/web/src/app/admin/PackagesTab.tsx`
- `apps/web/src/app/admin/PackagesTab.stories.tsx`

---

## Task 1: New SQLModel models

**Files:**
- Create: `apps/api/src/models/group.py`
- Modify: `apps/api/src/models/package.py`
- Modify: `apps/api/src/models/collection.py`
- Modify: `apps/api/src/models/__init__.py`

- [ ] **Step 1: Create `apps/api/src/models/group.py`**

```python
from datetime import UTC, date, datetime

from sqlalchemy import UniqueConstraint
from sqlalchemy.schema import ForeignKeyConstraint
from sqlmodel import Field, SQLModel


class Group(SQLModel, table=True):
    __tablename__ = "groups"
    __table_args__ = (UniqueConstraint("org_id", "name"),)

    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organisations.id")
    name: str
    is_default: bool = Field(default=False)


class GroupRead(SQLModel):
    id: int
    org_id: int
    name: str
    is_default: bool


class GroupMembership(SQLModel, table=True):
    __tablename__ = "group_memberships"

    group_id: int = Field(foreign_key="groups.id", primary_key=True)
    user_id: int = Field(foreign_key="users.id", primary_key=True)


class GroupPackage(SQLModel, table=True):
    __tablename__ = "group_packages"

    group_id: int = Field(foreign_key="groups.id", primary_key=True)
    package_id: int = Field(foreign_key="package.id", primary_key=True)


class OrgSubscription(SQLModel, table=True):
    __tablename__ = "org_subscriptions"
    __table_args__ = (UniqueConstraint("org_id", "package_id"),)

    id: int | None = Field(default=None, primary_key=True)
    org_id: int = Field(foreign_key="organisations.id")
    package_id: int = Field(foreign_key="package.id")
    start_date: date
    end_date: date | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC).replace(tzinfo=None)
    )


class OrgSubscriptionRead(SQLModel):
    id: int
    org_id: int
    package_id: int
    start_date: date
    end_date: date | None
    created_at: datetime


class PackageCollection(SQLModel, table=True):
    __tablename__ = "package_collections"

    package_id: int = Field(foreign_key="package.id", primary_key=True)
    collection_id: int = Field(foreign_key="collection.id", primary_key=True)
    scope: str = Field(default="all")  # "all" | "selected"


class PackageCollectionRead(SQLModel):
    package_id: int
    collection_id: int
    scope: str


class PackageCollectionDataset(SQLModel, table=True):
    __tablename__ = "package_collection_datasets"
    __table_args__ = (
        ForeignKeyConstraint(
            ["package_id", "collection_id"],
            ["package_collections.package_id", "package_collections.collection_id"],
            ondelete="CASCADE",
        ),
    )

    package_id: int = Field(primary_key=True)
    collection_id: int = Field(primary_key=True)
    dataset_id: int = Field(foreign_key="dataset.id", primary_key=True)
```

- [ ] **Step 2: Update `apps/api/src/models/package.py` — add `visibility` field**

```python
from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel

from src.models.collection import CollectionType


class PackageVisibility(StrEnum):
    public = "public"
    private = "private"


class PackageBase(SQLModel):
    name: str
    slug: str
    description: str | None = None
    visibility: PackageVisibility = PackageVisibility.public


class Package(PackageBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class PackageRead(PackageBase):
    id: int
    created_at: datetime


class CollectionSummary(SQLModel):
    id: int
    name: str
    slug: str
    collection_type: CollectionType


class PackageWithCollections(PackageRead):
    collections: list[CollectionSummary] = []
```

- [ ] **Step 3: Remove `package_id` from `apps/api/src/models/collection.py`**

Remove `package_id: int = Field(foreign_key="package.id")` from `CollectionBase`. Also remove it from `CollectionCreate`. The full updated `CollectionBase`:

```python
class CollectionBase(SQLModel):
    name: str
    slug: str
    description: str | None = None
    collection_type: CollectionType = CollectionType.generic
```

And `CollectionCreate`:

```python
class CollectionCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None
    collection_type: CollectionType = CollectionType.generic
    package_id: int  # kept on Create for API input; stored in PackageCollection join table
```

- [ ] **Step 4: Update `apps/api/src/models/__init__.py`**

Add these exports (append to existing file):

```python
from .group import (  # noqa: F401
    Group,
    GroupMembership,
    GroupPackage,
    GroupRead,
    OrgSubscription,
    OrgSubscriptionRead,
    PackageCollection,
    PackageCollectionDataset,
    PackageCollectionRead,
)
```

Also add `PackageVisibility` to the package import line:
```python
from .package import Package, PackageBase, PackageRead, PackageVisibility  # noqa: F401
```

- [ ] **Step 5: Commit**

```
feat(api): add access control SQLModel models (Group, OrgSubscription, PackageCollection)
```

---

## Task 2: Alembic migration

**Files:**
- Create: `apps/api/migrations/versions/XXXX_add_access_control_tables.py` (generated by alembic)
- Modify: `apps/api/migrations/env.py`

- [ ] **Step 1: Update `migrations/env.py` imports**

Replace the existing import block with:

```python
from src.models import (  # noqa: E402, F401
    Collection,
    Dataset,
    Field,
    Group,
    GroupMembership,
    GroupPackage,
    Level,
    Organisation,
    OrgMembership,
    OrgSubscription,
    Package,
    PackageCollection,
    PackageCollectionDataset,
    Response,
    User,
)
```

- [ ] **Step 2: Generate migration**

```bash
just db-migration "add access control tables"
```

- [ ] **Step 3: Review and rewrite the generated migration**

The auto-generated migration will add new tables but **will not handle the `collection.package_id` removal + data migration**. Edit the generated file so `upgrade()` is:

```python
def upgrade() -> None:
    # Add visibility to package
    op.add_column("package", sa.Column("visibility", sa.Text(), nullable=False, server_default="public"))

    # Create package_collections (replaces collection.package_id)
    op.create_table(
        "package_collections",
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.Text(), nullable=False, server_default="all"),
        sa.ForeignKeyConstraint(["collection_id"], ["collection.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["package.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("package_id", "collection_id"),
    )

    # Migrate existing collection.package_id data
    op.execute(
        "INSERT INTO package_collections (package_id, collection_id, scope) "
        "SELECT package_id, id, 'all' FROM collection WHERE package_id IS NOT NULL"
    )

    # Drop collection.package_id
    op.drop_constraint("collection_collectionbase_package_id_fkey", "collection", type_="foreignkey")
    op.drop_column("collection", "package_id")

    # Create package_collection_datasets
    op.create_table(
        "package_collection_datasets",
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("collection_id", sa.Integer(), nullable=False),
        sa.Column("dataset_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["package_id", "collection_id"],
            ["package_collections.package_id", "package_collections.collection_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["dataset_id"], ["dataset.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("package_id", "collection_id", "dataset_id"),
    )

    # Create org_subscriptions
    op.create_table(
        "org_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["package.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "package_id"),
    )

    # Create groups
    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("org_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["org_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("org_id", "name"),
    )

    # Create group_memberships
    op.create_table(
        "group_memberships",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "user_id"),
    )

    # Create group_packages
    op.create_table(
        "group_packages",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("package_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["package_id"], ["package.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "package_id"),
    )
```

And `downgrade()`:

```python
def downgrade() -> None:
    op.drop_table("group_packages")
    op.drop_table("group_memberships")
    op.drop_table("groups")
    op.drop_table("org_subscriptions")
    op.drop_table("package_collection_datasets")

    # Restore collection.package_id from package_collections before dropping
    op.add_column("collection", sa.Column("package_id", sa.Integer(), nullable=True))
    op.execute(
        "UPDATE collection c SET package_id = pc.package_id "
        "FROM package_collections pc WHERE pc.collection_id = c.id"
    )
    op.alter_column("collection", "package_id", nullable=False)
    op.create_foreign_key(
        "collection_collectionbase_package_id_fkey",
        "collection", "package",
        ["package_id"], ["id"],
    )

    op.drop_table("package_collections")
    op.drop_column("package", "visibility")
```

> **Note:** The FK constraint name `collection_collectionbase_package_id_fkey` is auto-generated by SQLModel. Verify the actual name against your DB before merging: `SELECT conname FROM pg_constraint WHERE conrelid = 'collection'::regclass AND contype = 'f';`

- [ ] **Step 4: Run migration**

```bash
just db-migrate
```

Expected: migration applies cleanly.

- [ ] **Step 5: Run migration tests**

```bash
just test-api -k test_migrations
```

Expected: all 3 migration tests pass.

- [ ] **Step 6: Commit**

```
feat(api): add access control migration — package visibility, package_collections, groups, org_subscriptions
```

---

## Task 3: Update repo/service/conftest for removed `collection.package_id`

**Files:**
- Modify: `apps/api/src/repositories/package_repo.py`
- Modify: `apps/api/src/repositories/collection_repo.py`
- Modify: `apps/api/src/services/package_service.py`
- Modify: `apps/api/tests/conftest.py`

- [ ] **Step 1: Replace `package_repo.get_collections_for_package`**

In `apps/api/src/repositories/package_repo.py`, replace the old `get_collections_for_package` function and add the new import:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection
from src.models.group import PackageCollection
from src.models.package import Package


async def get_all(session: AsyncSession) -> list[Package]:
    return list((await session.execute(select(Package))).scalars().all())


async def get_by_id(session: AsyncSession, package_id: int) -> Package | None:
    return (
        (await session.execute(select(Package).where(Package.id == package_id)))
        .scalars()
        .first()
    )


async def create_package(
    session: AsyncSession, name: str, slug: str, description: str | None = None
) -> Package:
    obj = Package(name=name, slug=slug, description=description)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_collections_for_package(
    session: AsyncSession, package_id: int
) -> list[Collection]:
    result = await session.execute(
        select(Collection)
        .join(PackageCollection, PackageCollection.collection_id == Collection.id)
        .where(PackageCollection.package_id == package_id)
    )
    return list(result.scalars().all())
```

- [ ] **Step 2: Replace `collection_repo.get_all_for_packages`**

In `apps/api/src/repositories/collection_repo.py`, update the first function:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection


async def get_all_for_packages(
    session: AsyncSession, package_ids: list[int]
) -> list[Collection]:
    if not package_ids:
        return []
    result = await session.execute(
        select(Collection)
        .join(PackageCollection, PackageCollection.collection_id == Collection.id)
        .where(PackageCollection.package_id.in_(package_ids))
    )
    return list(result.scalars().all())
```

- [ ] **Step 3: Update `package_service.get_scope`**

`get_scope` currently does `c.package_id` when building `collections_by_pkg`. Since we now join through `package_collections`, we need the join to carry the `package_id` through. Update `get_scope` in `apps/api/src/services/package_service.py`:

```python
async def get_scope(session: AsyncSession) -> list[ScopePackage]:
    packages = await package_repo.get_all(session)
    if not packages:
        return []

    pkg_ids = [p.id for p in packages if p.id is not None]

    # Fetch (package_id, collection) pairs via join table
    from src.models.group import PackageCollection
    from sqlalchemy import select as sa_select

    rows = list(
        (
            await session.execute(
                sa_select(PackageCollection.package_id, Collection)
                .join(Collection, Collection.id == PackageCollection.collection_id)
                .where(PackageCollection.package_id.in_(pkg_ids))
            )
        ).all()
    )

    col_ids = [r.Collection.id for r in rows if r.Collection.id is not None]
    datasets = await dataset_repo.get_all_for_collections(session, col_ids)

    datasets_by_col: dict[int | None, list[ScopeDataset]] = {}
    for d in datasets:
        datasets_by_col.setdefault(d.collection_id, []).append(
            ScopeDataset(id=pk(d), name=d.name)
        )

    collections_by_pkg: dict[int | None, list[ScopeCollection]] = {}
    for row in rows:
        c = row.Collection
        collections_by_pkg.setdefault(row.package_id, []).append(
            ScopeCollection(id=pk(c), name=c.name, datasets=datasets_by_col.get(c.id, []))
        )

    return [
        ScopePackage(id=pk(p), name=p.name, collections=collections_by_pkg.get(p.id, []))
        for p in packages
    ]
```

Add missing import at top of `package_service.py`:
```python
from src.models.collection import Collection
```

- [ ] **Step 4: Update `conftest.py` fixtures**

In `apps/api/tests/conftest.py`, the `bare_dataset` and `seeded_collection` fixtures use `Collection(package_id=...)`. Update them to create a `PackageCollection` row instead:

```python
from src.models.group import PackageCollection

@pytest_asyncio.fixture
async def bare_dataset(db: AsyncSession):
    """Minimal Package → Collection → Dataset chain via package_collections join."""
    pkg = Package(name="Test Package", slug="test-pkg-fixture")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(
        name="Test Collection",
        slug="test-col-fixture",
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    pc = PackageCollection(package_id=cast(int, pkg.id), collection_id=cast(int, col.id))
    db.add(pc)
    await db.flush()

    ds = Dataset(name="Test Dataset", slug="test-ds-fixture", collection_id=col.id, sort_order=0)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


@pytest_asyncio.fixture
async def seeded_collection(db: AsyncSession, seeded_package):
    col = Collection(
        name="Seeded Collection",
        slug="seeded-col-fixture",
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    pc = PackageCollection(
        package_id=cast(int, seeded_package.id), collection_id=cast(int, col.id)
    )
    db.add(pc)
    await db.flush()
    return col
```

Also add `from typing import cast` to the conftest imports if not already present.

- [ ] **Step 5: Run existing tests to confirm no regressions**

```bash
just test-api
```

Expected: all previously passing tests still pass.

- [ ] **Step 6: Commit**

```
fix(api): update repos and fixtures for collection.package_id removal
```

---

## Task 4: Auth layer — CurrentUser extension + get_accessible_package_ids

**Files:**
- Modify: `apps/api/src/auth.py`
- Modify: `apps/api/src/config.py`
- Modify: `apps/api/src/repositories/package_repo.py`
- Create: `apps/api/tests/test_access_control.py`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/test_access_control.py`:

```python
from datetime import date, timedelta
from typing import cast
from unittest.mock import patch

import pytest
import pytest_asyncio
from src.auth import CurrentUser, get_accessible_package_ids
from src.config import settings
from src.models.group import (
    Group,
    GroupMembership,
    GroupPackage,
    OrgSubscription,
)
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation, User


@pytest_asyncio.fixture
async def access_fixtures(db):
    """Org, user, public + private packages, group, subscription."""
    org = Organisation(clerk_org_id="org_test", name="Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)

    user = User(clerk_id="user_test", email="test@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    pub_pkg = Package(name="Public Pkg", slug="pub-pkg", visibility=PackageVisibility.public)
    priv_pkg = Package(name="Private Pkg", slug="priv-pkg", visibility=PackageVisibility.private)
    other_priv = Package(name="Other Private", slug="other-priv", visibility=PackageVisibility.private)
    db.add_all([pub_pkg, priv_pkg, other_priv])
    await db.flush()
    await db.refresh(pub_pkg)
    await db.refresh(priv_pkg)
    await db.refresh(other_priv)

    grp = Group(org_id=cast(int, org.id), name="Testers")
    db.add(grp)
    await db.flush()
    await db.refresh(grp)

    sub = OrgSubscription(
        org_id=cast(int, org.id),
        package_id=cast(int, priv_pkg.id),
        start_date=date.today() - timedelta(days=1),
    )
    db.add(sub)

    gm = GroupMembership(group_id=cast(int, grp.id), user_id=cast(int, user.id))
    gp = GroupPackage(group_id=cast(int, grp.id), package_id=cast(int, priv_pkg.id))
    db.add_all([gm, gp])
    await db.flush()

    return {
        "org": org, "user": user,
        "pub_pkg": pub_pkg, "priv_pkg": priv_pkg, "other_priv": other_priv,
        "group": grp,
    }


@pytest.mark.asyncio
async def test_public_package_always_accessible(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await get_accessible_package_ids.__wrapped__(current_user, db)
    assert cast(int, f["pub_pkg"].id) in ids


@pytest.mark.asyncio
async def test_subscribed_group_member_sees_private_package(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await get_accessible_package_ids.__wrapped__(current_user, db)
    assert cast(int, f["priv_pkg"].id) in ids


@pytest.mark.asyncio
async def test_unsubscribed_private_package_not_accessible(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await get_accessible_package_ids.__wrapped__(current_user, db)
    assert cast(int, f["other_priv"].id) not in ids


@pytest.mark.asyncio
async def test_expired_subscription_denied(db, access_fixtures):
    f = access_fixtures
    # Add an expired subscription for other_priv
    from src.models.group import GroupPackage, OrgSubscription
    expired_sub = OrgSubscription(
        org_id=cast(int, f["org"].id),
        package_id=cast(int, f["other_priv"].id),
        start_date=date.today() - timedelta(days=30),
        end_date=date.today() - timedelta(days=1),
    )
    expired_gp = GroupPackage(
        group_id=cast(int, f["group"].id),
        package_id=cast(int, f["other_priv"].id),
    )
    db.add_all([expired_sub, expired_gp])
    await db.flush()

    current_user = CurrentUser(
        clerk_id=f["user"].clerk_id,
        email=f["user"].email,
        org_id=f["org"].clerk_org_id,
    )
    ids = await get_accessible_package_ids.__wrapped__(current_user, db)
    assert cast(int, f["other_priv"].id) not in ids


@pytest.mark.asyncio
async def test_no_org_sees_only_public(db, access_fixtures):
    f = access_fixtures
    current_user = CurrentUser(clerk_id="no_org_user", email="noorg@test.com", org_id=None)
    ids = await get_accessible_package_ids.__wrapped__(current_user, db)
    assert cast(int, f["pub_pkg"].id) in ids
    assert cast(int, f["priv_pkg"].id) not in ids


def test_superuser_gets_none():
    current_user = CurrentUser(
        clerk_id="super", email="super@test.com", org_id=None, is_superuser=True
    )
    with patch.object(settings, "auth_mode", "production"):
        # Superuser path returns None without hitting the DB
        from src.auth import _superuser_bypass
        assert _superuser_bypass(current_user) is True
```

- [ ] **Step 2: Run tests to see them fail**

```bash
just test-api -k test_access_control
```

Expected: ImportError / AttributeError — `is_superuser`, `get_accessible_package_ids` not yet defined.

- [ ] **Step 3: Update `apps/api/src/config.py`**

Add `dev_superuser` field to `Settings`:

```python
dev_superuser: bool = False
```

- [ ] **Step 4: Update `apps/api/src/auth.py`**

```python
from dataclasses import dataclass, field
from datetime import date

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

import jwt

from src.config import settings
from src.database import get_session

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    clerk_id: str
    email: str
    org_id: str | None
    is_superuser: bool = field(default=False)


def _superuser_bypass(user: CurrentUser) -> bool:
    return user.is_superuser


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if settings.auth_mode == "dev":
        return CurrentUser(
            clerk_id="dev_user",
            email="dev@example.com",
            org_id=None,
            is_superuser=settings.dev_superuser,
        )

    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.clerk_jwt_key,
            algorithms=["RS256"],
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    public_meta = payload.get("public_metadata") or {}
    is_superuser = isinstance(public_meta, dict) and public_meta.get("role") == "superuser"

    return CurrentUser(
        clerk_id=payload["sub"],
        email=payload.get("email", ""),
        org_id=payload.get("org_id"),
        is_superuser=is_superuser,
    )


async def get_accessible_package_ids(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> set[int] | None:
    if settings.auth_mode == "dev":
        return None
    if current_user.is_superuser:
        return None
    from src.repositories import package_repo
    return await package_repo.get_accessible_ids(session, current_user)
```

- [ ] **Step 5: Add `get_accessible_ids` to `apps/api/src/repositories/package_repo.py`**

Add these imports and function:

```python
from datetime import date as date_type

from sqlalchemy import select, union

from src.models.group import Group, GroupMembership, GroupPackage, OrgSubscription
from src.models.user import Organisation, User


async def get_accessible_ids(
    session: AsyncSession, user: "CurrentUser"
) -> set[int]:
    from src.auth import CurrentUser  # local import to avoid circular

    public_q = select(Package.id).where(Package.visibility == "public")

    if user.org_id is None:
        result = await session.execute(public_q)
        return set(id_ for id_ in result.scalars().all() if id_ is not None)

    org_id_subq = (
        select(Organisation.id)
        .where(Organisation.clerk_org_id == user.org_id)
        .scalar_subquery()
    )
    user_id_subq = (
        select(User.id)
        .where(User.clerk_id == user.clerk_id)
        .scalar_subquery()
    )
    today = date_type.today()

    private_q = (
        select(Package.id)
        .join(OrgSubscription, OrgSubscription.package_id == Package.id)
        .join(GroupPackage, GroupPackage.package_id == Package.id)
        .join(
            Group,
            (Group.id == GroupPackage.group_id) & (Group.org_id == OrgSubscription.org_id),
        )
        .join(
            GroupMembership,
            (GroupMembership.group_id == Group.id)
            & (GroupMembership.user_id == user_id_subq),
        )
        .where(
            Package.visibility == "private",
            OrgSubscription.org_id == org_id_subq,
            OrgSubscription.start_date <= today,
            (OrgSubscription.end_date.is_(None)) | (OrgSubscription.end_date >= today),
        )
        .distinct()
    )

    combined = union(public_q, private_q)
    result = await session.execute(combined)
    return set(id_ for id_ in result.scalars().all() if id_ is not None)
```

- [ ] **Step 6: Run tests**

```bash
just test-api -k test_access_control
```

Expected: all pass.

- [ ] **Step 7: Run full test suite**

```bash
just test-api
```

Expected: all pass (including existing auth tests).

- [ ] **Step 8: Commit**

```
feat(api): add is_superuser to CurrentUser and get_accessible_package_ids dependency
```

---

## Task 5: Group repo, service, and webhook updates

**Files:**
- Create: `apps/api/src/repositories/group_repo.py`
- Create: `apps/api/src/services/group_service.py`
- Modify: `apps/api/src/services/user_service.py`

- [ ] **Step 1: Write failing webhook tests**

In `apps/api/tests/test_webhooks.py`, add these tests (at the end of the file):

```python
@pytest.mark.asyncio
async def test_org_created_creates_default_group(client, db):
    from src.models.group import Group
    from sqlalchemy import select

    payload = {
        "type": "organization.created",
        "data": {"id": "org_webhook_test", "name": "Webhook Test Org"},
    }
    resp = await client.post("/api/v1/webhooks/clerk", json=payload)
    assert resp.status_code == 200

    org_result = await db.execute(
        select(Organisation).where(Organisation.clerk_org_id == "org_webhook_test")
    )
    org = org_result.scalars().first()
    assert org is not None

    grp_result = await db.execute(
        select(Group).where(Group.org_id == org.id, Group.is_default == True)  # noqa: E712
    )
    grp = grp_result.scalars().first()
    assert grp is not None
    assert grp.name == "Default"


@pytest.mark.asyncio
async def test_membership_created_adds_user_to_default_group(client, db):
    from src.models.group import Group, GroupMembership
    from sqlalchemy import select

    # Create org + user via webhooks first
    await client.post("/api/v1/webhooks/clerk", json={
        "type": "organization.created",
        "data": {"id": "org_mem_test", "name": "Mem Test Org"},
    })
    await client.post("/api/v1/webhooks/clerk", json={
        "type": "user.created",
        "data": {
            "id": "user_mem_test",
            "first_name": "Test", "last_name": "User",
            "email_addresses": [{"email_address": "memtest@example.com"}],
        },
    })

    resp = await client.post("/api/v1/webhooks/clerk", json={
        "type": "organizationMembership.created",
        "data": {
            "role": "org:member",
            "public_user_data": {"user_id": "user_mem_test"},
            "organization": {"id": "org_mem_test"},
        },
    })
    assert resp.status_code == 200

    user_res = await db.execute(select(User).where(User.clerk_id == "user_mem_test"))
    user = user_res.scalars().first()
    org_res = await db.execute(select(Organisation).where(Organisation.clerk_org_id == "org_mem_test"))
    org = org_res.scalars().first()
    grp_res = await db.execute(
        select(Group).where(Group.org_id == org.id, Group.is_default == True)  # noqa: E712
    )
    grp = grp_res.scalars().first()

    gm_res = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == grp.id,
            GroupMembership.user_id == user.id,
        )
    )
    assert gm_res.scalars().first() is not None


@pytest.mark.asyncio
async def test_membership_deleted_removes_group_memberships(client, db):
    from src.models.group import Group, GroupMembership
    from sqlalchemy import select

    # Setup: create org, user, membership via webhooks
    await client.post("/api/v1/webhooks/clerk", json={
        "type": "organization.created",
        "data": {"id": "org_del_test", "name": "Del Test Org"},
    })
    await client.post("/api/v1/webhooks/clerk", json={
        "type": "user.created",
        "data": {
            "id": "user_del_test",
            "first_name": "Del", "last_name": "User",
            "email_addresses": [{"email_address": "del@example.com"}],
        },
    })
    await client.post("/api/v1/webhooks/clerk", json={
        "type": "organizationMembership.created",
        "data": {
            "role": "org:member",
            "public_user_data": {"user_id": "user_del_test"},
            "organization": {"id": "org_del_test"},
        },
    })

    resp = await client.post("/api/v1/webhooks/clerk", json={
        "type": "organizationMembership.deleted",
        "data": {
            "public_user_data": {"user_id": "user_del_test"},
            "organization": {"id": "org_del_test"},
        },
    })
    assert resp.status_code == 200

    user_res = await db.execute(select(User).where(User.clerk_id == "user_del_test"))
    user = user_res.scalars().first()
    org_res = await db.execute(select(Organisation).where(Organisation.clerk_org_id == "org_del_test"))
    org = org_res.scalars().first()

    # All group memberships in this org should be gone
    grp_res = await db.execute(select(Group).where(Group.org_id == org.id))
    group_ids = [g.id for g in grp_res.scalars().all()]

    gm_res = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id.in_(group_ids),
            GroupMembership.user_id == user.id,
        )
    )
    assert gm_res.scalars().first() is None
```

- [ ] **Step 2: Run tests to see them fail**

```bash
just test-api -k "test_org_created_creates_default_group or test_membership_created or test_membership_deleted_removes"
```

- [ ] **Step 3: Create `apps/api/src/repositories/group_repo.py`**

```python
from typing import cast

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.group import Group, GroupMembership, GroupPackage


async def create_group(
    session: AsyncSession,
    *,
    org_id: int,
    name: str,
    is_default: bool = False,
) -> Group:
    grp = Group(org_id=org_id, name=name, is_default=is_default)
    session.add(grp)
    await session.flush()
    await session.refresh(grp)
    return grp


async def get_default_group(session: AsyncSession, org_id: int) -> Group | None:
    result = await session.execute(
        select(Group).where(Group.org_id == org_id, Group.is_default == True)  # noqa: E712
    )
    return result.scalars().first()


async def get_groups_for_org(session: AsyncSession, org_id: int) -> list[Group]:
    result = await session.execute(select(Group).where(Group.org_id == org_id))
    return list(result.scalars().all())


async def get_group_by_id(session: AsyncSession, group_id: int) -> Group | None:
    return await session.get(Group, group_id)


async def delete_group(session: AsyncSession, group: Group) -> None:
    await session.delete(group)
    await session.flush()


async def add_member(session: AsyncSession, *, group_id: int, user_id: int) -> None:
    gm = GroupMembership(group_id=group_id, user_id=user_id)
    session.add(gm)
    await session.flush()


async def remove_member(
    session: AsyncSession, *, group_id: int, user_id: int
) -> None:
    await session.execute(
        delete(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == user_id,
        )
    )
    await session.flush()


async def remove_user_from_org_groups(
    session: AsyncSession, *, user_id: int, org_id: int
) -> None:
    group_ids_result = await session.execute(
        select(Group.id).where(Group.org_id == org_id)
    )
    group_ids = [gid for gid in group_ids_result.scalars().all() if gid is not None]
    if group_ids:
        await session.execute(
            delete(GroupMembership).where(
                GroupMembership.group_id.in_(group_ids),
                GroupMembership.user_id == user_id,
            )
        )
        await session.flush()


async def add_user_to_default_group(
    session: AsyncSession, *, user_id: int, org_id: int
) -> None:
    grp = await get_default_group(session, org_id)
    if grp is not None:
        await add_member(session, group_id=cast(int, grp.id), user_id=user_id)


async def assign_package(
    session: AsyncSession, *, group_id: int, package_id: int
) -> None:
    gp = GroupPackage(group_id=group_id, package_id=package_id)
    session.add(gp)
    await session.flush()


async def unassign_package(
    session: AsyncSession, *, group_id: int, package_id: int
) -> None:
    await session.execute(
        delete(GroupPackage).where(
            GroupPackage.group_id == group_id,
            GroupPackage.package_id == package_id,
        )
    )
    await session.flush()
```

- [ ] **Step 4: Update `apps/api/src/services/user_service.py`** — add three webhook actions

```python
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.repositories import group_repo, user_repo


async def handle_clerk_event(session: AsyncSession, payload: dict[str, object]) -> None:
    event_type: str = str(payload.get("type", ""))
    data: dict[str, object] = dict(payload.get("data", {}))

    if event_type in ("user.created", "user.updated"):
        email_addresses = list(data.get("email_addresses", []))
        first_addr = dict(email_addresses[0]) if email_addresses else {}
        email = str(first_addr.get("email_address", ""))
        first_name = str(data.get("first_name") or "")
        last_name = str(data.get("last_name") or "")
        display_name = f"{first_name} {last_name}".strip() or None
        await user_repo.upsert_user(
            session,
            clerk_id=str(data["id"]),
            email=email,
            display_name=display_name,
        )

    elif event_type in ("organization.created", "organization.updated"):
        org = await user_repo.upsert_organisation(
            session,
            clerk_org_id=str(data["id"]),
            name=str(data["name"]),
        )
        if event_type == "organization.created":
            await group_repo.create_group(
                session,
                org_id=cast(int, org.id),
                name="Default",
                is_default=True,
            )

    elif event_type == "organizationMembership.created":
        user_data = dict(data.get("public_user_data", {}))
        org_data = dict(data.get("organization", {}))
        user_clerk_id = str(user_data["user_id"])
        org_clerk_id = str(org_data["id"])
        role = str(data.get("role", "org:member")).removeprefix("org:")
        user = await user_repo.get_user_by_clerk_id(session, user_clerk_id)
        org = await user_repo.get_org_by_clerk_id(session, org_clerk_id)
        if user is not None and org is not None:
            await user_repo.upsert_membership(
                session,
                user_id=cast(int, user.id),
                org_id=cast(int, org.id),
                role=role,
            )
            await group_repo.add_user_to_default_group(
                session,
                user_id=cast(int, user.id),
                org_id=cast(int, org.id),
            )

    elif event_type == "organizationMembership.deleted":
        user_data = dict(data.get("public_user_data", {}))
        org_data = dict(data.get("organization", {}))
        user_clerk_id = str(user_data["user_id"])
        org_clerk_id = str(org_data["id"])
        user = await user_repo.get_user_by_clerk_id(session, user_clerk_id)
        org = await user_repo.get_org_by_clerk_id(session, org_clerk_id)
        if user is not None and org is not None:
            await group_repo.remove_user_from_org_groups(
                session,
                user_id=cast(int, user.id),
                org_id=cast(int, org.id),
            )
        await user_repo.delete_membership(
            session,
            user_clerk_id=user_clerk_id,
            org_clerk_id=org_clerk_id,
        )
```

- [ ] **Step 5: Run tests**

```bash
just test-api -k "test_org_created_creates_default_group or test_membership_created or test_membership_deleted_removes"
```

Expected: all pass.

- [ ] **Step 6: Run full suite**

```bash
just test-api
```

- [ ] **Step 7: Commit**

```
feat(api): add group_repo and update webhook handler for default group lifecycle
```

---

## Task 6: Group management routes

**Files:**
- Create: `apps/api/src/services/group_service.py`
- Create: `apps/api/src/routes/groups.py`
- Create: `apps/api/src/models/group.py` additions (response schemas)
- Modify: `apps/api/src/main.py`
- Create: `apps/api/tests/test_groups_api.py`

- [ ] **Step 1: Add response schemas to `apps/api/src/models/group.py`**

Append to the file:

```python
class GroupMemberRead(SQLModel):
    user_id: int
    clerk_id: str
    email: str
    display_name: str | None
    role: str


class GroupPackageRead(SQLModel):
    package_id: int
    name: str
    slug: str
    visibility: str


class GroupCreate(SQLModel):
    name: str


class GroupWithCounts(GroupRead):
    member_count: int
    package_count: int
```

- [ ] **Step 2: Write failing tests in `apps/api/tests/test_groups_api.py`**

```python
import pytest
import pytest_asyncio
from typing import cast
from src.models.group import Group, GroupMembership, GroupPackage
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation, User, OrgMembership


@pytest_asyncio.fixture
async def group_fixtures(db, client):
    org = Organisation(clerk_org_id="org_grp_test", name="Group Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)

    user = User(clerk_id="user_grp_test", email="grptest@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    membership = OrgMembership(
        user_id=cast(int, user.id), org_id=cast(int, org.id), role="admin"
    )
    db.add(membership)

    grp = Group(org_id=cast(int, org.id), name="Test Group")
    db.add(grp)
    await db.flush()
    await db.refresh(grp)

    pkg = Package(name="Test Pkg", slug="test-pkg-grp", visibility=PackageVisibility.private)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    return {"org": org, "user": user, "group": grp, "pkg": pkg}


@pytest.mark.asyncio
async def test_list_groups_for_org(client, group_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.get("/api/v1/groups")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    groups = resp.json()
    assert any(g["name"] == "Test Group" for g in groups)


@pytest.mark.asyncio
async def test_create_group(client, group_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = group_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.post("/api/v1/groups", json={"name": "New Group"})
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 201
    assert resp.json()["name"] == "New Group"


@pytest.mark.asyncio
async def test_cannot_delete_default_group(client, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app
    from typing import cast

    org = Organisation(clerk_org_id="org_del_grp", name="Del Grp Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)
    user = User(clerk_id="user_del_grp", email="delgrp@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)
    default_grp = Group(org_id=cast(int, org.id), name="Default", is_default=True)
    db.add(default_grp)
    await db.flush()
    await db.refresh(default_grp)

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=user.clerk_id, email=user.email, org_id=org.clerk_org_id
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.delete(f"/api/v1/groups/{default_grp.id}")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_cannot_manage_other_org_group(client, db, group_fixtures):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    other_org = Organisation(clerk_org_id="other_org_grp", name="Other Org")
    db.add(other_org)
    await db.flush()
    await db.refresh(other_org)
    other_grp = Group(org_id=cast(int, other_org.id), name="Other Group")
    db.add(other_grp)
    await db.flush()
    await db.refresh(other_grp)

    f = group_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    app.dependency_overrides[get_current_user] = override_user
    resp = await client.delete(f"/api/v1/groups/{other_grp.id}")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 403
```

- [ ] **Step 3: Run to confirm failures**

```bash
just test-api -k test_groups_api
```

- [ ] **Step 4: Create `apps/api/src/services/group_service.py`**

```python
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import ForbiddenError, GroupNotFoundError
from src.models.group import GroupCreate, GroupRead, GroupWithCounts
from src.repositories import group_repo, user_repo


async def list_groups(session: AsyncSession, clerk_org_id: str) -> list[GroupWithCounts]:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        return []
    groups = await group_repo.get_groups_for_org(session, cast(int, org.id))
    return [
        GroupWithCounts(
            id=cast(int, g.id),
            org_id=cast(int, g.org_id),
            name=g.name,
            is_default=g.is_default,
            member_count=0,
            package_count=0,
        )
        for g in groups
    ]


async def create_group(
    session: AsyncSession, clerk_org_id: str, body: GroupCreate
) -> GroupRead:
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None:
        raise ForbiddenError("Organisation not found")
    grp = await group_repo.create_group(
        session, org_id=cast(int, org.id), name=body.name
    )
    return GroupRead.model_validate(grp.model_dump())


async def delete_group(
    session: AsyncSession, group_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    if grp.is_default:
        raise GroupNotFoundError(group_id)  # surfaces as 422 via error mapping
    await group_repo.delete_group(session, grp)


async def add_member(
    session: AsyncSession, group_id: int, user_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.add_member(session, group_id=group_id, user_id=user_id)


async def remove_member(
    session: AsyncSession, group_id: int, user_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.remove_member(session, group_id=group_id, user_id=user_id)


async def assign_package(
    session: AsyncSession, group_id: int, package_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.assign_package(session, group_id=group_id, package_id=package_id)


async def unassign_package(
    session: AsyncSession, group_id: int, package_id: int, clerk_org_id: str
) -> None:
    grp = await group_repo.get_group_by_id(session, group_id)
    if grp is None:
        raise GroupNotFoundError(group_id)
    org = await user_repo.get_org_by_clerk_id(session, clerk_org_id)
    if org is None or grp.org_id != org.id:
        raise ForbiddenError("Group belongs to a different org")
    await group_repo.unassign_package(session, group_id=group_id, package_id=package_id)
```

- [ ] **Step 5: Add missing error types to `apps/api/src/errors.py`**

```python
class ForbiddenError(DomainError):
    status_code = 403
    code = "forbidden"

class GroupNotFoundError(DomainError):
    status_code = 404
    code = "group_not_found"

    def __init__(self, group_id: int) -> None:
        super().__init__(f"Group {group_id} not found")
```

Also check that `PackageNotFoundError` already maps `422` for the "default group cannot be deleted" case — if you want a distinct error, add:

```python
class CannotDeleteDefaultGroupError(DomainError):
    status_code = 422
    code = "cannot_delete_default_group"
```

Then in `group_service.delete_group`, raise `CannotDeleteDefaultGroupError()` instead of `GroupNotFoundError` when `is_default=True`.

- [ ] **Step 6: Create `apps/api/src/routes/groups.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.group import GroupCreate, GroupRead, GroupWithCounts
from src.services import group_service

router = APIRouter(tags=["groups"])


@router.get("/groups", response_model=list[GroupWithCounts])
async def list_groups(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all groups for the current user's organisation."""
    if current_user.org_id is None:
        return []
    return await group_service.list_groups(session, current_user.org_id)


@router.post("/groups", response_model=GroupRead, status_code=201)
async def create_group(
    body: GroupCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new group in the current user's organisation."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    return await group_service.create_group(session, current_user.org_id, body)


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Delete a group. The Default group cannot be deleted."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.delete_group(session, group_id, current_user.org_id)


class AddMemberBody(GroupCreate):
    user_id: int


@router.post("/groups/{group_id}/members", status_code=204)
async def add_member(
    group_id: int,
    body: AddMemberBody,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Add a user to a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.add_member(session, group_id, body.user_id, current_user.org_id)


@router.delete("/groups/{group_id}/members/{user_id}", status_code=204)
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a user from a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.remove_member(session, group_id, user_id, current_user.org_id)


class AssignPackageBody(GroupCreate):
    package_id: int


@router.post("/groups/{group_id}/packages", status_code=204)
async def assign_package(
    group_id: int,
    body: AssignPackageBody,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Assign a package to a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.assign_package(session, group_id, body.package_id, current_user.org_id)


@router.delete("/groups/{group_id}/packages/{package_id}", status_code=204)
async def unassign_package(
    group_id: int,
    package_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove a package from a group."""
    if current_user.org_id is None:
        raise HTTPException(403, "No active organisation")
    await group_service.unassign_package(session, group_id, package_id, current_user.org_id)
```

- [ ] **Step 7: Register router in `apps/api/src/main.py`**

Find where existing routers are registered and add:

```python
from src.routes import groups
app.include_router(groups.router, prefix="/api/v1")
```

- [ ] **Step 8: Run tests**

```bash
just test-api -k test_groups_api
```

Expected: all pass.

- [ ] **Step 9: Run full suite**

```bash
just test-api
```

- [ ] **Step 10: Commit**

```
feat(api): add group management routes (create, delete, members, packages)
```

---

## Task 7: Admin routes

**Files:**
- Create: `apps/api/src/repositories/admin_repo.py`
- Create: `apps/api/src/services/admin_service.py`
- Create: `apps/api/src/routes/admin.py`
- Create: `apps/api/tests/test_admin_api.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write failing admin tests in `apps/api/tests/test_admin_api.py`**

```python
import pytest
import pytest_asyncio
from typing import cast
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation


@pytest_asyncio.fixture
async def admin_fixtures(db):
    org = Organisation(clerk_org_id="org_admin_test", name="Admin Test Org")
    db.add(org)
    await db.flush()
    await db.refresh(org)
    pkg = Package(name="Admin Pkg", slug="admin-pkg", visibility=PackageVisibility.private)
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    return {"org": org, "pkg": pkg}


@pytest.mark.asyncio
async def test_admin_list_orgs_requires_superuser(client):
    resp = await client.get("/api/v1/admin/orgs")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_orgs_as_superuser(client, admin_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    resp = await client.get("/api/v1/admin/orgs")
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    orgs = resp.json()
    assert any(o["name"] == "Admin Test Org" for o in orgs)


@pytest.mark.asyncio
async def test_admin_subscribe_org_to_package(client, admin_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = admin_fixtures

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    resp = await client.post(
        f"/api/v1/admin/orgs/{f['org'].id}/subscriptions",
        json={"package_id": f["pkg"].id, "start_date": "2026-01-01"},
    )
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 201
    data = resp.json()
    assert data["package_id"] == f["pkg"].id


@pytest.mark.asyncio
async def test_admin_update_package_visibility(client, admin_fixtures, db):
    from src.auth import CurrentUser, get_current_user
    from src.main import app

    f = admin_fixtures

    def override_superuser() -> CurrentUser:
        return CurrentUser(
            clerk_id="super_user", email="super@test.com", org_id=None, is_superuser=True
        )

    app.dependency_overrides[get_current_user] = override_superuser
    resp = await client.patch(
        f"/api/v1/admin/packages/{f['pkg'].id}",
        json={"visibility": "public"},
    )
    app.dependency_overrides.pop(get_current_user, None)

    assert resp.status_code == 200
    assert resp.json()["visibility"] == "public"
```

- [ ] **Step 2: Run to confirm failures**

```bash
just test-api -k test_admin_api
```

- [ ] **Step 3: Create `apps/api/src/repositories/admin_repo.py`**

```python
from datetime import date
from typing import cast

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.group import OrgSubscription
from src.models.package import Package, PackageVisibility
from src.models.user import Organisation


async def list_orgs(session: AsyncSession) -> list[Organisation]:
    result = await session.execute(select(Organisation))
    return list(result.scalars().all())


async def get_org_by_id(session: AsyncSession, org_id: int) -> Organisation | None:
    return await session.get(Organisation, org_id)


async def list_subscriptions(
    session: AsyncSession, org_id: int
) -> list[OrgSubscription]:
    result = await session.execute(
        select(OrgSubscription).where(OrgSubscription.org_id == org_id)
    )
    return list(result.scalars().all())


async def create_subscription(
    session: AsyncSession,
    *,
    org_id: int,
    package_id: int,
    start_date: date,
    end_date: date | None = None,
) -> OrgSubscription:
    sub = OrgSubscription(
        org_id=org_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
    )
    session.add(sub)
    await session.flush()
    await session.refresh(sub)
    return sub


async def delete_subscription(
    session: AsyncSession, org_id: int, package_id: int
) -> None:
    await session.execute(
        delete(OrgSubscription).where(
            OrgSubscription.org_id == org_id,
            OrgSubscription.package_id == package_id,
        )
    )
    await session.flush()


async def update_package_visibility(
    session: AsyncSession, package_id: int, visibility: PackageVisibility
) -> Package | None:
    pkg = await session.get(Package, package_id)
    if pkg is None:
        return None
    pkg.visibility = visibility
    await session.flush()
    await session.refresh(pkg)
    return pkg
```

- [ ] **Step 4: Create `apps/api/src/services/admin_service.py`**

```python
from datetime import date
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import PackageNotFoundError
from src.models.group import OrgSubscriptionRead
from src.models.package import PackageRead, PackageVisibility
from src.models.user import OrganisationRead
from src.repositories import admin_repo


async def list_orgs(session: AsyncSession) -> list[OrganisationRead]:
    orgs = await admin_repo.list_orgs(session)
    return [OrganisationRead.model_validate(o.model_dump()) for o in orgs]


async def list_subscriptions(
    session: AsyncSession, org_id: int
) -> list[OrgSubscriptionRead]:
    subs = await admin_repo.list_subscriptions(session, org_id)
    return [OrgSubscriptionRead.model_validate(s.model_dump()) for s in subs]


async def create_subscription(
    session: AsyncSession,
    *,
    org_id: int,
    package_id: int,
    start_date: date,
    end_date: date | None,
) -> OrgSubscriptionRead:
    sub = await admin_repo.create_subscription(
        session,
        org_id=org_id,
        package_id=package_id,
        start_date=start_date,
        end_date=end_date,
    )
    return OrgSubscriptionRead.model_validate(sub.model_dump())


async def delete_subscription(
    session: AsyncSession, org_id: int, package_id: int
) -> None:
    await admin_repo.delete_subscription(session, org_id, package_id)


async def update_package_visibility(
    session: AsyncSession, package_id: int, visibility: PackageVisibility
) -> PackageRead:
    pkg = await admin_repo.update_package_visibility(session, package_id, visibility)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    return PackageRead.model_validate(pkg.model_dump())
```

- [ ] **Step 5: Create `apps/api/src/routes/admin.py`**

```python
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.group import OrgSubscriptionRead
from src.models.package import PackageRead, PackageVisibility
from src.models.user import OrganisationRead
from src.services import admin_service

router = APIRouter(tags=["admin"])


def _require_superuser(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current_user.is_superuser:
        raise HTTPException(403, "Super-user access required")
    return current_user


@router.get("/admin/orgs", response_model=list[OrganisationRead])
async def list_orgs(
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List all organisations (super-user only)."""
    return await admin_service.list_orgs(session)


@router.get("/admin/orgs/{org_id}/subscriptions", response_model=list[OrgSubscriptionRead])
async def list_subscriptions(
    org_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """List package subscriptions for an org (super-user only)."""
    return await admin_service.list_subscriptions(session, org_id)


class SubscriptionCreate(SQLModel):
    package_id: int
    start_date: date
    end_date: date | None = None


@router.post(
    "/admin/orgs/{org_id}/subscriptions",
    response_model=OrgSubscriptionRead,
    status_code=201,
)
async def create_subscription(
    org_id: int,
    body: SubscriptionCreate,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Subscribe an org to a private package (super-user only)."""
    return await admin_service.create_subscription(
        session,
        org_id=org_id,
        package_id=body.package_id,
        start_date=body.start_date,
        end_date=body.end_date,
    )


@router.delete("/admin/orgs/{org_id}/subscriptions/{package_id}", status_code=204)
async def delete_subscription(
    org_id: int,
    package_id: int,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Remove an org's subscription to a package (super-user only)."""
    await admin_service.delete_subscription(session, org_id, package_id)


class PackageUpdate(SQLModel):
    visibility: PackageVisibility | None = None
    name: str | None = None
    description: str | None = None


@router.patch("/admin/packages/{package_id}", response_model=PackageRead)
async def update_package(
    package_id: int,
    body: PackageUpdate,
    _: CurrentUser = Depends(_require_superuser),
    session: AsyncSession = Depends(get_session),
):
    """Update a package's visibility or metadata (super-user only)."""
    if body.visibility is not None:
        return await admin_service.update_package_visibility(
            session, package_id, body.visibility
        )
    raise HTTPException(422, "No updatable fields provided")
```

- [ ] **Step 6: Register admin router in `apps/api/src/main.py`**

```python
from src.routes import admin
app.include_router(admin.router, prefix="/api/v1")
```

- [ ] **Step 7: Run tests**

```bash
just test-api -k test_admin_api
```

Expected: all pass.

- [ ] **Step 8: Run full suite**

```bash
just test-api
```

- [ ] **Step 9: Commit**

```
feat(api): add admin routes for org subscriptions and package management
```

---

## Task 8: Wire access filtering to existing routes + generate types

**Files:**
- Modify: `apps/api/src/routes/packages.py`
- Modify: `apps/api/src/routes/analytics.py`
- Modify: `apps/api/src/routes/ai.py`
- Modify: `apps/api/src/routes/collections.py`
- Modify: `apps/api/src/routes/datasets.py`
- Modify: `apps/api/src/services/analytics_service.py`
- Modify: `apps/api/src/services/ai_service.py`

- [ ] **Step 1: Write access-filtering integration test**

Add to `apps/api/tests/test_access_control.py`:

```python
@pytest.mark.asyncio
async def test_packages_route_filters_by_accessible_ids(client, db, access_fixtures):
    from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
    from src.main import app

    f = access_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    async def override_accessible() -> set[int] | None:
        return {cast(int, f["pub_pkg"].id), cast(int, f["priv_pkg"].id)}

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_accessible_package_ids] = override_accessible

    resp = await client.get("/api/v1/packages")
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_accessible_package_ids, None)

    assert resp.status_code == 200
    pkg_ids = {p["id"] for p in resp.json()}
    assert cast(int, f["pub_pkg"].id) in pkg_ids
    assert cast(int, f["priv_pkg"].id) in pkg_ids
    assert cast(int, f["other_priv"].id) not in pkg_ids


@pytest.mark.asyncio
async def test_analytics_rejects_inaccessible_dataset(client, db, bare_dataset, access_fixtures):
    from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
    from src.main import app

    f = access_fixtures

    def override_user() -> CurrentUser:
        return CurrentUser(
            clerk_id=f["user"].clerk_id,
            email=f["user"].email,
            org_id=f["org"].clerk_org_id,
        )

    async def override_accessible() -> set[int] | None:
        return set()  # no packages accessible

    app.dependency_overrides[get_current_user] = override_user
    app.dependency_overrides[get_accessible_package_ids] = override_accessible

    resp = await client.post(
        "/api/v1/analytics/crosstab",
        json={
            "dataset_id": bare_dataset.id,
            "rows": [],
            "columns": [],
            "row_mode": "stacked",
            "col_mode": "stacked",
        },
    )
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_accessible_package_ids, None)

    assert resp.status_code == 403
```

- [ ] **Step 2: Run to confirm failures**

```bash
just test-api -k "test_packages_route_filters or test_analytics_rejects"
```

- [ ] **Step 3: Update `apps/api/src/routes/packages.py`**

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
from src.database import get_session
from src.models.package import PackageRead, PackageWithCollections
from src.repositories import package_repo
from src.services import package_service

router = APIRouter(tags=["packages"])


class PackageCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None


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


@router.get("/packages", response_model=list[PackageRead])
async def list_packages(
    _: CurrentUser = Depends(get_current_user),
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """List all packages (top-level groupings of survey collections)."""
    pkgs = await package_repo.get_all(session)
    if accessible_ids is None:
        return pkgs
    return [p for p in pkgs if p.id in accessible_ids]


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
async def get_package(
    package_id: int,
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """Get a package with its collections."""
    return await package_service.get_with_collections(session, package_id, accessible_ids)
```

- [ ] **Step 4: Update `package_service.get_with_collections` to accept `accessible_ids`**

In `apps/api/src/services/package_service.py`, update the signature:

```python
async def get_with_collections(
    session: AsyncSession,
    package_id: int,
    accessible_ids: set[int] | None = None,
) -> PackageWithCollections:
    """Raises PackageNotFoundError if package_id does not exist or is not accessible."""
    from src.errors import ForbiddenError
    pkg = await package_repo.get_by_id(session, package_id)
    if pkg is None:
        raise PackageNotFoundError(package_id)
    if accessible_ids is not None and pkg.id not in accessible_ids:
        raise ForbiddenError("Package not accessible")
    collections = await package_repo.get_collections_for_package(session, package_id)
    return PackageWithCollections.model_validate(
        {
            **pkg.model_dump(),
            "collections": [CollectionSummary.model_validate(c.model_dump()) for c in collections],
        }
    )
```

- [ ] **Step 5: Update `apps/api/src/routes/analytics.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
from src.database import get_session
from src.models.analytics import CrosstabRequest, CrosstabResponse, TrendRequest, TrendResponse
from src.services import analytics_service

router = APIRouter(tags=["analytics"])


@router.post("/analytics/crosstab", response_model=CrosstabResponse)
async def run_crosstab(
    request: CrosstabRequest,
    _: CurrentUser = Depends(get_current_user),
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """Run a cross-tabulation: rows × columns × optional breakdown, with optional weighting."""
    if request.row_mode == "nested" and len(request.rows) > 2:
        raise HTTPException(422, "Nested row mode supports at most 2 fields")
    if request.row_mode == "stacked" and len(request.rows) > 5:
        raise HTTPException(422, "Stacked row mode supports at most 5 fields")
    if request.col_mode == "nested" and len(request.columns) > 2:
        raise HTTPException(422, "Nested col mode supports at most 2 fields")
    return await analytics_service.run_crosstab(session, request, accessible_ids)


@router.post("/analytics/trend", response_model=TrendResponse)
async def run_trend(
    request: TrendRequest,
    _: CurrentUser = Depends(get_current_user),
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """Run a trend analysis: track a field's distribution across datasets in a collection over time."""
    return await analytics_service.run_trend(session, request, accessible_ids)
```

- [ ] **Step 6: Update `apps/api/src/services/analytics_service.py`** — add `accessible_ids` param and dataset access check

Open `apps/api/src/services/analytics_service.py`. Add `accessible_ids: set[int] | None = None` to both `run_crosstab` and `run_trend` signatures. At the top of each function, add a dataset access check:

```python
from src.errors import ForbiddenError
from src.repositories import package_repo as pkg_repo

async def _assert_dataset_accessible(
    session: AsyncSession,
    dataset_id: int,
    accessible_ids: set[int] | None,
) -> None:
    if accessible_ids is None:
        return
    # Find packages containing this dataset's collection
    from sqlalchemy import select
    from src.models.group import PackageCollection
    from src.models.dataset import Dataset
    from src.models.collection import Collection
    ds = await session.get(Dataset, dataset_id)
    if ds is None:
        return
    result = await session.execute(
        select(PackageCollection.package_id).where(
            PackageCollection.collection_id == ds.collection_id
        )
    )
    pkg_ids = set(result.scalars().all())
    if not pkg_ids.intersection(accessible_ids):
        raise ForbiddenError("Dataset not accessible")
```

Call `await _assert_dataset_accessible(session, request.dataset_id, accessible_ids)` at the start of both service functions before any other logic.

- [ ] **Step 7: Add auth to `apps/api/src/routes/ai.py` and `apps/api/src/routes/collections.py` and `apps/api/src/routes/datasets.py`**

For each, add `_: CurrentUser = Depends(get_current_user)` to every route handler. For the AI route also pass `accessible_ids` to the AI service (follow the same pattern as analytics). The AI service should accept `accessible_ids: set[int] | None` and pass it to its data source selection logic — read `apps/api/src/services/ai_service.py` first to find where packages are queried, then add the filtering there.

- [ ] **Step 8: Run all tests**

```bash
just test-api
```

Expected: all pass.

- [ ] **Step 9: Generate types**

```bash
just generate-types
```

Verify `packages/shared/api.d.ts` has no new `unknown` return types for modified routes.

- [ ] **Step 10: Commit**

```
feat(api): wire access control filtering to packages, analytics, collections, datasets, ai routes
```

---

## Task 9: /org/groups frontend page

> **REQUIRED:** Invoke the `frontend-design` skill before writing any component in this task.

**Files:**
- Create: `apps/web/src/app/org/groups/page.tsx`
- Create: `apps/web/src/app/org/groups/GroupsPage.tsx` + `.stories.tsx`
- Create: `apps/web/src/app/org/groups/GroupsList.tsx` + `.stories.tsx`
- Create: `apps/web/src/app/org/groups/MembersPanel.tsx` + `.stories.tsx`
- Create: `apps/web/src/app/org/groups/PackagesPanel.tsx` + `.stories.tsx`

- [ ] **Step 1: Invoke `frontend-design` skill**

Use the `frontend-design` skill before writing any component. Pass context: three-panel layout for group management (groups list, members panel, packages panel). Use design tokens only: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`.

- [ ] **Step 2: Create `apps/web/src/app/org/groups/page.tsx`**

```tsx
import { GroupsPage } from "./GroupsPage"

export default function Page() {
  return <GroupsPage />
}
```

- [ ] **Step 3: Create `apps/web/src/app/org/groups/GroupsPage.tsx`**

```tsx
"use client"

import { useState } from "react"
import { GroupsList } from "./GroupsList"
import { MembersPanel } from "./MembersPanel"
import { PackagesPanel } from "./PackagesPanel"

export function GroupsPage() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-foreground text-lg font-semibold">Groups</h1>
        <p className="text-muted-foreground text-sm">
          Manage groups and their access to packages for your organisation.
        </p>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-4">
        <GroupsList
          selectedGroupId={selectedGroupId}
          onSelect={setSelectedGroupId}
        />
        <MembersPanel groupId={selectedGroupId} />
        <PackagesPanel groupId={selectedGroupId} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `apps/web/src/app/org/groups/GroupsList.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import createClient from "openapi-fetch"
import type { paths, components } from "@eggscaliber/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Group = components["schemas"]["GroupWithCounts"]

const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL })

interface Props {
  selectedGroupId: number | null
  onSelect: (id: number) => void
}

export function GroupsList({ selectedGroupId, onSelect }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.GET("/api/v1/groups").then(({ data }) => {
      if (data) setGroups(data)
    })
  }, [])

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div
      data-testid="groups-list"
      className="bg-card border-border flex flex-col rounded-lg border"
    >
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-foreground text-sm font-semibold">Groups</span>
        <Button size="sm" variant="default">
          + New Group
        </Button>
      </div>
      <div className="border-border border-b p-2">
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((g) => (
          <button
            key={g.id}
            data-testid={`group-row-${g.id}`}
            onClick={() => onSelect(g.id)}
            className={`border-border flex w-full items-center gap-2 border-b px-4 py-2 text-left text-sm transition-colors last:border-b-0 ${
              selectedGroupId === g.id
                ? "bg-primary/10 text-foreground font-semibold"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="flex-1">{g.name}</span>
            {g.is_default && (
              <span className="text-muted-foreground text-xs">default</span>
            )}
            <span className="text-muted-foreground text-xs">
              {g.member_count}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `apps/web/src/app/org/groups/GroupsList.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GroupsList } from "./GroupsList"

const meta = {
  component: GroupsList,
  args: {
    selectedGroupId: null,
    onSelect: () => {},
  },
} satisfies Meta<typeof GroupsList>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithGroups: Story = {
  args: { selectedGroupId: 2 },
}
```

- [ ] **Step 6: Create `apps/web/src/app/org/groups/MembersPanel.tsx`**

```tsx
"use client"

interface Props {
  groupId: number | null
}

export function MembersPanel({ groupId }: Props) {
  if (!groupId) {
    return (
      <div
        data-testid="members-panel"
        className="bg-card border-border flex items-center justify-center rounded-lg border"
      >
        <p className="text-muted-foreground text-sm">
          Select a group to manage members
        </p>
      </div>
    )
  }

  return (
    <div data-testid="members-panel" className="bg-card border-border flex flex-col rounded-lg border">
      <div className="border-border border-b px-4 py-3">
        <span className="text-foreground text-sm font-semibold">Members</span>
      </div>
      <div className="flex-1 p-4">
        <p className="text-muted-foreground text-sm">Group {groupId} members</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Create `apps/web/src/app/org/groups/MembersPanel.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { MembersPanel } from "./MembersPanel"

const meta = {
  component: MembersPanel,
  args: { groupId: null },
} satisfies Meta<typeof MembersPanel>

export default meta
type Story = StoryObj<typeof meta>

export const NoSelection: Story = {}
export const WithGroup: Story = { args: { groupId: 1 } }
```

- [ ] **Step 8: Create `apps/web/src/app/org/groups/PackagesPanel.tsx` and `.stories.tsx`**

Follow the same pattern as `MembersPanel` — empty state when `groupId` is null, package list when selected. Fetch from `GET /api/v1/groups/{group_id}/packages` (add endpoint if not already in types after `just generate-types`). Story: `NoSelection` and `WithGroup` variants.

- [ ] **Step 9: Create `apps/web/src/app/org/groups/GroupsPage.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GroupsPage } from "./GroupsPage"

const meta = { component: GroupsPage } satisfies Meta<typeof GroupsPage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
```

- [ ] **Step 10: Verify Storybook**

```bash
just storybook
```

Open http://localhost:6006. Confirm all GroupsPage stories render with no a11y violations.

- [ ] **Step 11: Commit**

```
feat(web): add /org/groups page with GroupsList, MembersPanel, PackagesPanel
```

---

## Task 10: /admin frontend page

> **REQUIRED:** Invoke the `frontend-design` skill before writing any component in this task.

**Files:**
- Create: `apps/web/src/app/admin/page.tsx`
- Create: `apps/web/src/app/admin/AdminPage.tsx` + `.stories.tsx`
- Create: `apps/web/src/app/admin/SubscriptionsTab.tsx` + `.stories.tsx`
- Create: `apps/web/src/app/admin/PackagesTab.tsx` + `.stories.tsx`

- [ ] **Step 1: Invoke `frontend-design` skill**

Pass context: two-tab admin layout. Subscriptions tab: org sidebar + package subscription table with date inputs. Packages tab: package list sidebar + collection/dataset composition table.

- [ ] **Step 2: Create `apps/web/src/app/admin/page.tsx`**

```tsx
import { AdminPage } from "./AdminPage"

export default function Page() {
  return <AdminPage />
}
```

- [ ] **Step 3: Create `apps/web/src/app/admin/AdminPage.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import createClient from "openapi-fetch"
import type { paths, components } from "@eggscaliber/shared"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SubscriptionsTab } from "./SubscriptionsTab"
import { PackagesTab } from "./PackagesTab"

type Org = components["schemas"]["OrganisationRead"]

const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL })

export function AdminPage() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.GET("/api/v1/admin/orgs").then(({ data, error }) => {
      if (error) {
        router.replace("/analytics")
        return
      }
      if (data) {
        setOrgs(data)
        if (data[0]) setSelectedOrgId(data[0].id)
      }
      setLoading(false)
    })
  }, [router])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 gap-0">
      <aside
        data-testid="admin-org-sidebar"
        className="bg-card border-border w-52 shrink-0 border-r"
      >
        <div className="border-border border-b px-3 py-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Organisations
          </p>
        </div>
        <div className="overflow-auto">
          {orgs.map((org) => (
            <button
              key={org.id}
              data-testid={`admin-org-${org.id}`}
              onClick={() => setSelectedOrgId(org.id)}
              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                selectedOrgId === org.id
                  ? "bg-primary/10 text-foreground font-semibold"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <Tabs defaultValue="subscriptions" className="flex flex-1 flex-col">
          <TabsList className="border-border w-full justify-start rounded-none border-b bg-transparent px-4">
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
          </TabsList>
          <TabsContent value="subscriptions" className="flex-1 p-4">
            <SubscriptionsTab orgId={selectedOrgId} />
          </TabsContent>
          <TabsContent value="packages" className="flex-1 p-4">
            <PackagesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `apps/web/src/app/admin/SubscriptionsTab.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import createClient from "openapi-fetch"
import type { paths, components } from "@eggscaliber/shared"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"

type Sub = components["schemas"]["OrgSubscriptionRead"]
type Pkg = components["schemas"]["PackageRead"]

const api = createClient<paths>({ baseUrl: process.env.NEXT_PUBLIC_API_URL })

interface Props {
  orgId: number | null
}

export function SubscriptionsTab({ orgId }: Props) {
  const [packages, setPackages] = useState<Pkg[]>([])
  const [subscriptions, setSubscriptions] = useState<Sub[]>([])

  useEffect(() => {
    api.GET("/api/v1/packages").then(({ data }) => {
      if (data) setPackages(data)
    })
  }, [])

  useEffect(() => {
    if (orgId === null) return
    api
      .GET("/api/v1/admin/orgs/{org_id}/subscriptions", {
        params: { path: { org_id: orgId } },
      })
      .then(({ data }) => {
        if (data) setSubscriptions(data)
      })
  }, [orgId])

  if (!orgId) {
    return (
      <p className="text-muted-foreground text-sm">Select an organisation</p>
    )
  }

  const subByPackage = Object.fromEntries(subscriptions.map((s) => [s.package_id, s]))

  return (
    <div data-testid="subscriptions-tab" className="bg-card border-border rounded-lg border">
      <div className="bg-muted border-border grid grid-cols-[1fr_100px_110px_110px] gap-2 border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider">
        <span className="text-muted-foreground">Package</span>
        <span className="text-muted-foreground">Subscribed</span>
        <span className="text-muted-foreground">Start Date</span>
        <span className="text-muted-foreground">End Date</span>
      </div>
      {packages.map((pkg) => {
        const sub = subByPackage[pkg.id]
        return (
          <div
            key={pkg.id}
            data-testid={`sub-row-${pkg.id}`}
            className="border-border grid grid-cols-[1fr_100px_110px_110px] items-center gap-2 border-b px-4 py-2 last:border-b-0"
          >
            <div>
              <span className="text-foreground text-sm font-medium">
                {pkg.name}
              </span>
              <span className="text-muted-foreground ml-2 text-xs">
                {pkg.visibility}
              </span>
            </div>
            <Switch checked={!!sub} onCheckedChange={() => {}} />
            <Input
              type="date"
              className="h-7 text-xs"
              value={sub?.start_date ?? ""}
              disabled={!sub}
              onChange={() => {}}
            />
            <Input
              type="date"
              className="h-7 text-xs"
              value={sub?.end_date ?? ""}
              disabled={!sub}
              placeholder="No end"
              onChange={() => {}}
            />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Create `apps/web/src/app/admin/SubscriptionsTab.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { SubscriptionsTab } from "./SubscriptionsTab"

const meta = {
  component: SubscriptionsTab,
  args: { orgId: null },
} satisfies Meta<typeof SubscriptionsTab>

export default meta
type Story = StoryObj<typeof meta>

export const NoOrg: Story = {}
export const WithOrg: Story = { args: { orgId: 1 } }
```

- [ ] **Step 6: Create `apps/web/src/app/admin/PackagesTab.tsx`**

Package list on the left sidebar; on the right, for the selected package show: visibility toggle badge, collections table with Include switch, Dataset Scope select, and dataset chip selector when scope = "selected". Follow the same API + design-token patterns as `SubscriptionsTab`.

Key structure:

```tsx
"use client"

import { useState } from "react"

export function PackagesTab() {
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)

  return (
    <div data-testid="packages-tab" className="flex gap-4">
      {/* Package sidebar */}
      <div className="bg-card border-border w-48 shrink-0 rounded-lg border">
        {/* Package list with search */}
      </div>
      {/* Collection/dataset composition */}
      <div className="bg-card border-border flex-1 rounded-lg border">
        {selectedPackageId ? (
          <PackageComposition packageId={selectedPackageId} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">Select a package</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

Implement `PackageComposition` in the same file. Fetch from `GET /api/v1/admin/packages/{package_id}/collections`. For each collection row: Include `<Switch>`, Scope `<Select>` (All / Selected), and when "selected" show dataset chips (fetch datasets for the collection and show each with a toggle state backed by `package_collection_datasets` state).

- [ ] **Step 7: Create `apps/web/src/app/admin/PackagesTab.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { PackagesTab } from "./PackagesTab"

const meta = { component: PackagesTab } satisfies Meta<typeof PackagesTab>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
```

- [ ] **Step 8: Create `apps/web/src/app/admin/AdminPage.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AdminPage } from "./AdminPage"

const meta = { component: AdminPage } satisfies Meta<typeof AdminPage>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
```

- [ ] **Step 9: Verify Storybook**

```bash
just storybook
```

Confirm all AdminPage stories render with no a11y violations.

- [ ] **Step 10: Run lint**

```bash
just lint
```

Fix any design-token violations (no raw hex, no `text-primary` as text colour, no `dark:` overrides).

- [ ] **Step 11: Commit**

```
feat(web): add /admin page with SubscriptionsTab and PackagesTab
```

---

## Task 11: Update roadmap + final checks

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Run full test suite**

```bash
just test
```

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

```bash
just typecheck
```

Fix any type errors.

- [ ] **Step 3: Mark Phase 2 complete in roadmap**

In `docs/ROADMAP.md`, update Phase 2 status:

```markdown
- **Phase 2 — Access Control** ✅ Complete — `groups` table, `group_memberships`, `group_packages`, `org_subscriptions`, `package_collections`; analytics and package endpoints filter by group membership; super-user subscription management UI.
```

- [ ] **Step 4: Final commit**

```
feat(api,web): complete AuthN & AuthZ Phase 2 — group-based access control
```
