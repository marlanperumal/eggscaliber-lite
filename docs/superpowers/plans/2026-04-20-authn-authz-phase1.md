# AuthN & AuthZ — Phase 1: Identity Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Clerk end-to-end: protected Next.js routes, JWT-verified FastAPI endpoints, webhook-synced user/org DB tables, and Clerk-hosted sign-in/sign-up/account UI.

**Architecture:** Clerk handles identity on the frontend (hosted UI components + ClerkProvider). FastAPI verifies Clerk JWTs via `CLERK_JWT_KEY` (PEM public key, networkless) using PyJWT. Clerk webhooks sync `users`, `organisations`, and `org_memberships` tables into Postgres via a svix-verified endpoint. The existing `AUTH_MODE=dev` bypass is preserved for local development without Clerk credentials.

**Tech Stack:** `@clerk/nextjs` v7.2.3, `@clerk/testing` v2.0.17, `pyjwt[crypto]` (PyJWT), `svix` v1.90.0

**Spec:** `docs/superpowers/specs/2026-04-20-authn-authz-design.md`

---

## File Map

**Create:**
- `apps/api/src/models/user.py` — User, Organisation, OrgMembership SQLModel tables
- `apps/api/src/repositories/user_repo.py` — upsert/delete functions for webhook sync
- `apps/api/src/auth.py` — `CurrentUser` dataclass + `get_current_user` FastAPI dependency
- `apps/api/src/routes/webhooks.py` — `POST /api/v1/webhooks/clerk` handler
- `apps/api/tests/test_user_repo.py` — repo unit tests
- `apps/api/tests/test_auth.py` — auth dependency unit tests
- `apps/api/tests/test_webhooks.py` — webhook handler tests
- `apps/web/src/middleware.ts` — `clerkMiddleware` route protection
- `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` — Clerk `<SignIn />` page
- `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` page
- `apps/web/src/app/account/[[...account]]/page.tsx` — Clerk `<UserProfile />` page

**Modify:**
- `apps/api/src/config.py` — add `clerk_jwt_key`, `clerk_webhook_secret` settings
- `apps/api/src/models/__init__.py` — export new auth models
- `apps/api/migrations/env.py` — import User, Organisation, OrgMembership
- `apps/api/src/main.py` — include webhooks router; add `get_current_user` dependency to protected routers
- `apps/api/tests/conftest.py` — override `get_current_user` so existing tests pass
- `apps/web/src/app/layout.tsx` — wrap root with `<ClerkProvider>`
- `apps/web/src/components/ui/top-nav.tsx` — replace hardcoded avatar with `<UserButton>` + `<OrganizationSwitcher>`
- `apps/web/src/components/ui/TopNav.test.tsx` — add `@clerk/nextjs` mock
- `docs/ROADMAP.md` — split SP8 into Phase 1 and Phase 2 iterations
- `.env.example` — add `CLERK_JWT_KEY`, `CLERK_WEBHOOK_SECRET`

---

## Task 1: Update roadmap — split SP8 into phases

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Update the SP8 row and summary in ROADMAP.md**

Replace the current SP8 table row and summary block with two phase iterations. The table row becomes:

```markdown
| 8 | Full AuthN & AuthZ | ⏳ In Progress | [spec](superpowers/specs/2026-04-20-authn-authz-design.md) | [plan](superpowers/plans/2026-04-20-authn-authz-phase1.md) |
```

Replace the SP8 summary section with:

```markdown
### 8 — Full AuthN & AuthZ

- **Phase 1 — Identity Stack** ⏳ In Progress — Clerk wired end-to-end: sign-in/sign-up/account UI, Next.js middleware route protection, FastAPI JWT verification, webhook-synced `users`/`organisations`/`org_memberships` tables, org creation and invite flows via Clerk's built-in UI.
- **Phase 2 — Access Control** ⏳ Pending — `groups` table (org-scoped), `group_memberships`, `group_packages`; analytics and package endpoints filter by group membership; super-user role.

**Done when:** A user can register, join an org, be assigned to a group, and access only the packages that group is entitled to — end-to-end in production.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs(docs): split SP8 into Phase 1 and Phase 2 in roadmap"
```

---

## Task 2: Install dependencies

**Files:**
- Modify: `apps/web/package.json`, `apps/api/pyproject.toml` (via just commands)

- [ ] **Step 1: Add Clerk Next.js SDK**

```bash
just add-web-dep @clerk/nextjs
```

- [ ] **Step 2: Add Clerk testing utilities**

```bash
just add-web-dev-dep @clerk/testing
```

- [ ] **Step 3: Add PyJWT with crypto support**

```bash
just add-api-dep "pyjwt[crypto]"
```

- [ ] **Step 4: Add svix for webhook signature verification**

```bash
just add-api-dep svix
```

- [ ] **Step 5: Verify installs**

```bash
just typecheck
```

Expected: passes (no new type errors from the added packages).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/api/pyproject.toml apps/api/uv.lock
git commit -m "deps(deps): add @clerk/nextjs, @clerk/testing, pyjwt[crypto], svix"
```

---

## Task 3: Auth DB models

**Files:**
- Create: `apps/api/src/models/user.py`
- Modify: `apps/api/src/models/__init__.py`

- [ ] **Step 1: Create `apps/api/src/models/user.py`**

```python
from datetime import datetime

from sqlmodel import Field, SQLModel


class UserBase(SQLModel):
    clerk_id: str = Field(unique=True, index=True)
    email: str
    display_name: str | None = None


class User(UserBase, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserRead(UserBase):
    id: int
    created_at: datetime


class OrganisationBase(SQLModel):
    clerk_org_id: str = Field(unique=True, index=True)
    name: str


class Organisation(OrganisationBase, table=True):
    __tablename__ = "organisations"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OrganisationRead(OrganisationBase):
    id: int
    created_at: datetime


class OrgMembershipBase(SQLModel):
    user_id: int = Field(foreign_key="users.id")
    org_id: int = Field(foreign_key="organisations.id")
    role: str


class OrgMembership(OrgMembershipBase, table=True):
    __tablename__ = "org_memberships"

    id: int | None = Field(default=None, primary_key=True)
```

- [ ] **Step 2: Export new models from `apps/api/src/models/__init__.py`**

Add to the end of the existing imports:

```python
from .user import OrgMembership, Organisation, OrganisationRead, User, UserRead  # noqa: F401
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/models/user.py apps/api/src/models/__init__.py
git commit -m "feat(api): add User, Organisation, OrgMembership SQLModel tables"
```

---

## Task 4: Alembic migration for auth tables

**Files:**
- Modify: `apps/api/migrations/env.py`
- Create: `apps/api/migrations/versions/<hash>_add_auth_tables.py` (generated)

- [ ] **Step 1: Import new models in `apps/api/migrations/env.py`**

Update the import block (lines 18–25) to include the new models:

```python
from src.models import (  # noqa: E402, F401
    Collection,
    Dataset,
    Field,
    Level,
    OrgMembership,
    Organisation,
    Package,
    Response,
    User,
)
```

- [ ] **Step 2: Generate the migration**

```bash
just db-migration "add auth tables"
```

- [ ] **Step 3: Review the generated migration**

Open the newly created file in `apps/api/migrations/versions/`. Verify `upgrade()` creates three tables in this order (foreign key order matters):

```python
# Expected upgrade() — exact column names must match the models
op.create_table(
    "users",
    sa.Column("clerk_id", sa.String(), nullable=False),
    sa.Column("email", sa.String(), nullable=False),
    sa.Column("display_name", sa.String(), nullable=True),
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("clerk_id"),
)
op.create_index("ix_users_clerk_id", "users", ["clerk_id"])
op.create_table(
    "organisations",
    sa.Column("clerk_org_id", sa.String(), nullable=False),
    sa.Column("name", sa.String(), nullable=False),
    sa.Column("id", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint("id"),
    sa.UniqueConstraint("clerk_org_id"),
)
op.create_index("ix_organisations_clerk_org_id", "organisations", ["clerk_org_id"])
op.create_table(
    "org_memberships",
    sa.Column("user_id", sa.Integer(), nullable=False),
    sa.Column("org_id", sa.Integer(), nullable=False),
    sa.Column("role", sa.String(), nullable=False),
    sa.Column("id", sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(["org_id"], ["organisations.id"]),
    sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    sa.PrimaryKeyConstraint("id"),
)
```

`downgrade()` must drop in reverse order: `org_memberships`, `organisations`, `users`.

If Alembic generated anything different, edit to match before continuing.

- [ ] **Step 4: Run migration tests**

```bash
just test-api -k migration
```

Expected: all 3 migration tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/env.py apps/api/migrations/versions/
git commit -m "feat(api): migration — add users, organisations, org_memberships tables"
```

---

## Task 5: User and org repositories

**Files:**
- Create: `apps/api/src/repositories/user_repo.py`
- Create: `apps/api/tests/test_user_repo.py`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/tests/test_user_repo.py`:

```python
from typing import cast

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.user import OrgMembership, Organisation, User
from src.repositories import user_repo


@pytest.mark.asyncio
async def test_upsert_user_creates_new(db: AsyncSession):
    user = await user_repo.upsert_user(
        db, clerk_id="user_abc", email="a@example.com", display_name="Alice"
    )
    assert user.id is not None
    assert user.clerk_id == "user_abc"
    assert user.email == "a@example.com"
    assert user.display_name == "Alice"


@pytest.mark.asyncio
async def test_upsert_user_updates_existing(db: AsyncSession):
    await user_repo.upsert_user(db, clerk_id="user_abc", email="old@example.com", display_name=None)
    updated = await user_repo.upsert_user(
        db, clerk_id="user_abc", email="new@example.com", display_name="Alice Updated"
    )
    assert updated.email == "new@example.com"
    assert updated.display_name == "Alice Updated"


@pytest.mark.asyncio
async def test_upsert_organisation_creates_new(db: AsyncSession):
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_xyz", name="Acme")
    assert org.id is not None
    assert org.clerk_org_id == "org_xyz"
    assert org.name == "Acme"


@pytest.mark.asyncio
async def test_upsert_organisation_updates_existing(db: AsyncSession):
    await user_repo.upsert_organisation(db, clerk_org_id="org_xyz", name="Old Name")
    updated = await user_repo.upsert_organisation(db, clerk_org_id="org_xyz", name="New Name")
    assert updated.name == "New Name"


@pytest.mark.asyncio
async def test_upsert_membership_creates(db: AsyncSession):
    user = await user_repo.upsert_user(db, clerk_id="user_m1", email="m@example.com", display_name=None)
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_m1", name="Org M")
    membership = await user_repo.upsert_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id), role="admin"
    )
    assert membership.id is not None
    assert membership.role == "admin"


@pytest.mark.asyncio
async def test_upsert_membership_updates_role(db: AsyncSession):
    user = await user_repo.upsert_user(db, clerk_id="user_m2", email="m2@example.com", display_name=None)
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_m2", name="Org M2")
    uid, oid = cast(int, user.id), cast(int, org.id)
    await user_repo.upsert_membership(db, user_id=uid, org_id=oid, role="member")
    updated = await user_repo.upsert_membership(db, user_id=uid, org_id=oid, role="admin")
    assert updated.role == "admin"


@pytest.mark.asyncio
async def test_delete_membership_removes_row(db: AsyncSession):
    user = await user_repo.upsert_user(db, clerk_id="user_m3", email="m3@example.com", display_name=None)
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_m3", name="Org M3")
    await user_repo.upsert_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id), role="member"
    )
    await user_repo.delete_membership(db, user_clerk_id="user_m3", org_clerk_id="org_m3")
    membership = await user_repo.get_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    assert membership is None


@pytest.mark.asyncio
async def test_delete_membership_noop_when_missing(db: AsyncSession):
    # Should not raise when user or org does not exist
    await user_repo.delete_membership(db, user_clerk_id="nonexistent", org_clerk_id="nonexistent")


@pytest.mark.asyncio
async def test_get_user_by_clerk_id_returns_none_for_missing(db: AsyncSession):
    result = await user_repo.get_user_by_clerk_id(db, "does_not_exist")
    assert result is None


@pytest.mark.asyncio
async def test_get_org_by_clerk_id_returns_none_for_missing(db: AsyncSession):
    result = await user_repo.get_org_by_clerk_id(db, "does_not_exist")
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
just test-api -k test_user_repo
```

Expected: `ImportError` or `ModuleNotFoundError` — `user_repo` does not exist yet.

- [ ] **Step 3: Create `apps/api/src/repositories/user_repo.py`**

```python
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.models.user import OrgMembership, Organisation, User


async def upsert_user(
    session: AsyncSession,
    *,
    clerk_id: str,
    email: str,
    display_name: str | None,
) -> User:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalars().first()
    if user is None:
        user = User(clerk_id=clerk_id, email=email, display_name=display_name)
    else:
        user.email = email
        user.display_name = display_name
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user


async def get_user_by_clerk_id(session: AsyncSession, clerk_id: str) -> User | None:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    return result.scalars().first()


async def upsert_organisation(
    session: AsyncSession,
    *,
    clerk_org_id: str,
    name: str,
) -> Organisation:
    result = await session.execute(
        select(Organisation).where(Organisation.clerk_org_id == clerk_org_id)
    )
    org = result.scalars().first()
    if org is None:
        org = Organisation(clerk_org_id=clerk_org_id, name=name)
    else:
        org.name = name
    session.add(org)
    await session.flush()
    await session.refresh(org)
    return org


async def get_org_by_clerk_id(session: AsyncSession, clerk_org_id: str) -> Organisation | None:
    result = await session.execute(
        select(Organisation).where(Organisation.clerk_org_id == clerk_org_id)
    )
    return result.scalars().first()


async def upsert_membership(
    session: AsyncSession,
    *,
    user_id: int,
    org_id: int,
    role: str,
) -> OrgMembership:
    result = await session.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
    )
    membership = result.scalars().first()
    if membership is None:
        membership = OrgMembership(user_id=user_id, org_id=org_id, role=role)
    else:
        membership.role = role
    session.add(membership)
    await session.flush()
    await session.refresh(membership)
    return membership


async def get_membership(
    session: AsyncSession,
    *,
    user_id: int,
    org_id: int,
) -> OrgMembership | None:
    result = await session.execute(
        select(OrgMembership).where(
            OrgMembership.user_id == user_id,
            OrgMembership.org_id == org_id,
        )
    )
    return result.scalars().first()


async def delete_membership(
    session: AsyncSession,
    *,
    user_clerk_id: str,
    org_clerk_id: str,
) -> None:
    user = await get_user_by_clerk_id(session, user_clerk_id)
    org = await get_org_by_clerk_id(session, org_clerk_id)
    if user is None or org is None:
        return
    membership = await get_membership(
        session, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    if membership is not None:
        await session.delete(membership)
        await session.flush()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
just test-api -k test_user_repo
```

Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/repositories/user_repo.py apps/api/tests/test_user_repo.py
git commit -m "feat(api): add user/org/membership repo with upsert and delete"
```

---

## Task 6: Auth config and `get_current_user` dependency

**Files:**
- Modify: `apps/api/src/config.py`
- Create: `apps/api/src/auth.py`
- Create: `apps/api/tests/test_auth.py`

- [ ] **Step 1: Write failing tests for `get_current_user`**

Create `apps/api/tests/test_auth.py`:

```python
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from src.auth import CurrentUser, get_current_user
from src.config import settings
from unittest.mock import patch


def _make_rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    return private_pem, public_pem


def _make_token(private_pem: str, payload: dict) -> str:
    return jwt.encode(payload, private_pem, algorithm="RS256")


def test_dev_mode_returns_dev_user():
    with patch.object(settings, "auth_mode", "dev"):
        user = get_current_user(credentials=None)
    assert user.clerk_id == "dev_user"
    assert user.email == "dev@example.com"
    assert user.org_id is None


def test_missing_credentials_raises_401():
    with patch.object(settings, "auth_mode", "production"):
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials=None)
    assert exc_info.value.status_code == 401


def test_invalid_token_raises_401():
    from fastapi.security import HTTPAuthorizationCredentials

    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not.a.real.token")
    with patch.object(settings, "auth_mode", "production"):
        with patch.object(settings, "clerk_jwt_key", "not-a-real-key"):
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(credentials=creds)
    assert exc_info.value.status_code == 401


def test_valid_token_returns_current_user():
    from fastapi.security import HTTPAuthorizationCredentials

    private_pem, public_pem = _make_rsa_keypair()
    token = _make_token(
        private_pem,
        {"sub": "user_test123", "email": "test@example.com", "org_id": "org_abc"},
    )
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with patch.object(settings, "auth_mode", "production"):
        with patch.object(settings, "clerk_jwt_key", public_pem):
            user = get_current_user(credentials=creds)
    assert user.clerk_id == "user_test123"
    assert user.email == "test@example.com"
    assert user.org_id == "org_abc"


def test_valid_token_without_org_id():
    from fastapi.security import HTTPAuthorizationCredentials

    private_pem, public_pem = _make_rsa_keypair()
    token = _make_token(private_pem, {"sub": "user_noorg", "email": "noorg@example.com"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with patch.object(settings, "auth_mode", "production"):
        with patch.object(settings, "clerk_jwt_key", public_pem):
            user = get_current_user(credentials=creds)
    assert user.org_id is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
just test-api -k test_auth
```

Expected: `ImportError` — `src.auth` does not exist.

- [ ] **Step 3: Add settings to `apps/api/src/config.py`**

Add two fields inside the `Settings` class, after the existing `auth_mode` and `dev_jwt_secret` lines:

```python
    clerk_jwt_key: str = ""
    clerk_webhook_secret: str = ""
```

- [ ] **Step 4: Create `apps/api/src/auth.py`**

```python
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import settings

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    clerk_id: str
    email: str
    org_id: str | None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if settings.auth_mode == "dev":
        return CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)

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

    return CurrentUser(
        clerk_id=payload["sub"],
        email=payload.get("email", ""),
        org_id=payload.get("org_id"),
    )
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
just test-api -k test_auth
```

Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config.py apps/api/src/auth.py apps/api/tests/test_auth.py
git commit -m "feat(api): add get_current_user dependency with JWT verification and dev bypass"
```

---

## Task 7: Protect existing API routes

**Files:**
- Modify: `apps/api/src/main.py`
- Modify: `apps/api/tests/conftest.py`

- [ ] **Step 1: Add `get_current_user` as a router-level dependency in `apps/api/src/main.py`**

Import `get_current_user` and `Depends` at the top:

```python
from fastapi import Depends, FastAPI, Request
from src.auth import get_current_user
```

Update the router includes to add `dependencies=[Depends(get_current_user)]` to all protected routers (all except `health`, `sentry`, and `uploads` — `uploads` is protected separately because it uses session-level auth in Phase 2):

```python
app.include_router(health.router, prefix="/api/v1")
app.include_router(sentry.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(scope.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(collections.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(datasets.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(analytics.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(ai.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
app.include_router(uploads.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
```

- [ ] **Step 2: Run existing tests — expect auth failures**

```bash
just test-api
```

Expected: many existing tests fail with 401 or `MissingDependency` — this is correct because the `client` fixture doesn't yet override `get_current_user`.

- [ ] **Step 3: Override `get_current_user` in `apps/api/tests/conftest.py`**

Add the import at the top of conftest.py alongside existing imports:

```python
from src.auth import CurrentUser, get_current_user
```

Update the `client` fixture to override `get_current_user` alongside the existing `get_session` override:

```python
@pytest_asyncio.fixture
async def client(db: AsyncSession):
    async def override_get_session():
        yield db

    def override_get_current_user() -> CurrentUser:
        return CurrentUser(clerk_id="test_user", email="test@example.com", org_id=None)

    app.dependency_overrides[get_session] = override_get_session
    app.dependency_overrides[get_current_user] = override_get_current_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 4: Run all tests to verify they pass again**

```bash
just test-api
```

Expected: all tests pass (same count as before this task).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main.py apps/api/tests/conftest.py
git commit -m "feat(api): protect API routes with get_current_user dependency"
```

---

## Task 8: Clerk webhook handler

**Files:**
- Create: `apps/api/src/routes/webhooks.py`
- Modify: `apps/api/src/main.py`
- Create: `apps/api/tests/test_webhooks.py`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/test_webhooks.py`:

```python
import json
from typing import cast
from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from src.repositories import user_repo


@pytest.mark.asyncio
async def test_invalid_signature_returns_400(client: AsyncClient):
    payload = {"type": "user.created", "data": {"id": "user_abc"}}
    response = await client.post(
        "/api/v1/webhooks/clerk",
        content=json.dumps(payload),
        headers={
            "content-type": "application/json",
            "svix-id": "msg_test",
            "svix-timestamp": "1234567890",
            "svix-signature": "v1,invalidsig",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_user_created_upserts_user(client: AsyncClient, db: AsyncSession):
    payload = {
        "type": "user.created",
        "data": {
            "id": "user_wh1",
            "email_addresses": [{"email_address": "wh@example.com"}],
            "first_name": "Webhook",
            "last_name": "User",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={"content-type": "application/json", "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x"},
        )

    assert response.status_code == 200
    user = await user_repo.get_user_by_clerk_id(db, "user_wh1")
    assert user is not None
    assert user.email == "wh@example.com"
    assert user.display_name == "Webhook User"


@pytest.mark.asyncio
async def test_user_updated_updates_user(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_user(db, clerk_id="user_wh2", email="old@example.com", display_name="Old")
    payload = {
        "type": "user.updated",
        "data": {
            "id": "user_wh2",
            "email_addresses": [{"email_address": "new@example.com"}],
            "first_name": "New",
            "last_name": "Name",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={"content-type": "application/json", "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x"},
        )

    user = await user_repo.get_user_by_clerk_id(db, "user_wh2")
    assert user is not None
    assert user.email == "new@example.com"
    assert user.display_name == "New Name"


@pytest.mark.asyncio
async def test_organization_created_upserts_org(client: AsyncClient, db: AsyncSession):
    payload = {
        "type": "organization.created",
        "data": {"id": "org_wh1", "name": "Webhook Org"},
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={"content-type": "application/json", "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x"},
        )

    assert response.status_code == 200
    org = await user_repo.get_org_by_clerk_id(db, "org_wh1")
    assert org is not None
    assert org.name == "Webhook Org"


@pytest.mark.asyncio
async def test_membership_created_upserts_membership(client: AsyncClient, db: AsyncSession):
    await user_repo.upsert_user(db, clerk_id="user_mem1", email="mem@example.com", display_name=None)
    await user_repo.upsert_organisation(db, clerk_org_id="org_mem1", name="Mem Org")
    payload = {
        "type": "organizationMembership.created",
        "data": {
            "organization": {"id": "org_mem1"},
            "public_user_data": {"user_id": "user_mem1"},
            "role": "org:admin",
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={"content-type": "application/json", "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x"},
        )

    assert response.status_code == 200
    user = await user_repo.get_user_by_clerk_id(db, "user_mem1")
    org = await user_repo.get_org_by_clerk_id(db, "org_mem1")
    membership = await user_repo.get_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    assert membership is not None
    assert membership.role == "admin"


@pytest.mark.asyncio
async def test_membership_deleted_removes_membership(client: AsyncClient, db: AsyncSession):
    user = await user_repo.upsert_user(db, clerk_id="user_del1", email="del@example.com", display_name=None)
    org = await user_repo.upsert_organisation(db, clerk_org_id="org_del1", name="Del Org")
    await user_repo.upsert_membership(db, user_id=cast(int, user.id), org_id=cast(int, org.id), role="member")
    payload = {
        "type": "organizationMembership.deleted",
        "data": {
            "organization": {"id": "org_del1"},
            "public_user_data": {"user_id": "user_del1"},
        },
    }
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={"content-type": "application/json", "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x"},
        )

    membership = await user_repo.get_membership(
        db, user_id=cast(int, user.id), org_id=cast(int, org.id)
    )
    assert membership is None


@pytest.mark.asyncio
async def test_unknown_event_type_returns_200(client: AsyncClient):
    payload = {"type": "session.created", "data": {}}
    mock_wh = MagicMock()
    mock_wh.verify.return_value = payload

    with patch("src.routes.webhooks.Webhook", return_value=mock_wh):
        response = await client.post(
            "/api/v1/webhooks/clerk",
            content=json.dumps(payload),
            headers={"content-type": "application/json", "svix-id": "m", "svix-timestamp": "1", "svix-signature": "v1,x"},
        )

    assert response.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
just test-api -k test_webhooks
```

Expected: `ImportError` — `src.routes.webhooks` does not exist.

- [ ] **Step 3: Create `apps/api/src/routes/webhooks.py`**

```python
from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel
from svix.webhooks import Webhook, WebhookVerificationError

from src.config import settings
from src.database import get_session
from src.repositories import user_repo

router = APIRouter(tags=["webhooks"])


class WebhookAck(SQLModel):
    status: str


@router.post("/webhooks/clerk", response_model=WebhookAck)
async def clerk_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> WebhookAck:
    """Receive and process Clerk webhook events."""
    raw_body = await request.body()
    headers = dict(request.headers)

    wh = Webhook(settings.clerk_webhook_secret)
    try:
        payload = wh.verify(raw_body, headers)
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type: str = payload.get("type", "")
    data: dict = payload.get("data", {})

    if event_type in ("user.created", "user.updated"):
        email_addresses = data.get("email_addresses", [])
        email = email_addresses[0]["email_address"] if email_addresses else ""
        first_name = data.get("first_name") or ""
        last_name = data.get("last_name") or ""
        display_name = f"{first_name} {last_name}".strip() or None
        await user_repo.upsert_user(
            session,
            clerk_id=data["id"],
            email=email,
            display_name=display_name,
        )

    elif event_type in ("organization.created", "organization.updated"):
        await user_repo.upsert_organisation(
            session,
            clerk_org_id=data["id"],
            name=data["name"],
        )

    elif event_type == "organizationMembership.created":
        user_clerk_id: str = data["public_user_data"]["user_id"]
        org_clerk_id: str = data["organization"]["id"]
        role: str = data.get("role", "org:member").removeprefix("org:")
        user = await user_repo.get_user_by_clerk_id(session, user_clerk_id)
        org = await user_repo.get_org_by_clerk_id(session, org_clerk_id)
        if user is not None and org is not None:
            await user_repo.upsert_membership(
                session,
                user_id=cast(int, user.id),
                org_id=cast(int, org.id),
                role=role,
            )

    elif event_type == "organizationMembership.deleted":
        user_clerk_id = data["public_user_data"]["user_id"]
        org_clerk_id = data["organization"]["id"]
        await user_repo.delete_membership(
            session,
            user_clerk_id=user_clerk_id,
            org_clerk_id=org_clerk_id,
        )

    return WebhookAck(status="ok")
```

- [ ] **Step 4: Register the webhook router in `apps/api/src/main.py`**

Add `webhooks` to the imports at the top:

```python
from src.routes import (
    ai,
    analytics,
    collections,
    datasets,
    health,
    packages,
    scope,
    sentry,
    uploads,
    webhooks,
)
```

Add the router include **before** the protected routers (webhooks must not use `get_current_user`):

```python
app.include_router(health.router, prefix="/api/v1")
app.include_router(sentry.router, prefix="/api/v1")
app.include_router(webhooks.router, prefix="/api/v1")
app.include_router(packages.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
# ... rest unchanged
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
just test-api -k test_webhooks
```

Expected: all 7 webhook tests pass.

- [ ] **Step 6: Run full test suite**

```bash
just test-api
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/webhooks.py apps/api/src/main.py apps/api/tests/test_webhooks.py
git commit -m "feat(api): add Clerk webhook handler with svix verification"
```

---

## Task 9: Next.js middleware

**Files:**
- Create: `apps/web/src/middleware.ts`

- [ ] **Step 1: Create `apps/web/src/middleware.ts`**

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
```

- [ ] **Step 2: Run typecheck**

```bash
just typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(web): add clerkMiddleware route protection"
```

---

## Task 10: ClerkProvider and auth pages

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`
- Create: `apps/web/src/app/account/[[...account]]/page.tsx`

- [ ] **Step 1: Wrap root layout with `<ClerkProvider>`**

Update `apps/web/src/app/layout.tsx` — add `ClerkProvider` import and wrap the return:

```tsx
import { ClerkProvider } from "@clerk/nextjs"
import { PostHogPageView, PostHogProvider } from "@posthog/next"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { TopNav } from "@/components/ui/top-nav"
import { themeConfig } from "@/config/theme.config"
import { generateThemeCSS } from "@/lib/theme"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Eggscaliber Lite",
  description: "Data analysis platform",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Theme CSS injected here so tokens resolve before first paint */}
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS-only content, no user input */}
          <style dangerouslySetInnerHTML={{ __html: generateThemeCSS(themeConfig) }} />
        </head>
        <body className={`${inter.className} flex min-h-screen flex-col`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <NuqsAdapter>
              <PostHogProvider
                clientOptions={{ api_host: "/ingest", debug: process.env.NODE_ENV === "development" }}
              >
                <PostHogPageView />
                <TopNav />
                <main className="flex-1 overflow-hidden">{children}</main>
              </PostHogProvider>
            </NuqsAdapter>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 2: Create sign-in page**

Create `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`:

```tsx
import { SignIn } from "@clerk/nextjs"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  )
}
```

- [ ] **Step 3: Create sign-up page**

Create `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`:

```tsx
import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  )
}
```

- [ ] **Step 4: Create account page**

Create `apps/web/src/app/account/[[...account]]/page.tsx`:

```tsx
import { UserProfile } from "@clerk/nextjs"

export default function AccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center py-8">
      <UserProfile />
    </div>
  )
}
```

- [ ] **Step 5: Run typecheck and web tests**

```bash
just typecheck
just test-web
```

Expected: passes (the new pages have no logic to test at unit level).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/sign-in apps/web/src/app/sign-up apps/web/src/app/account
git commit -m "feat(web): add ClerkProvider, sign-in, sign-up, and account pages"
```

---

## Task 11: TopNav — UserButton and OrganizationSwitcher

**Files:**
- Modify: `apps/web/src/components/ui/top-nav.tsx`
- Modify: `apps/web/src/components/ui/TopNav.test.tsx`

- [ ] **Step 1: Update TopNav test to mock `@clerk/nextjs`**

Add a mock for `@clerk/nextjs` at the top of `apps/web/src/components/ui/TopNav.test.tsx`, after the existing mocks:

```typescript
vi.mock("@clerk/nextjs", () => ({
  OrganizationSwitcher: () => null,
  UserButton: () => null,
}))
```

- [ ] **Step 2: Run existing TopNav tests to verify mock doesn't break them**

```bash
just test-web -t "TopNav"
```

Expected: all 4 existing tests pass.

- [ ] **Step 3: Replace hardcoded avatar in `apps/web/src/components/ui/top-nav.tsx`**

Remove the `Avatar`, `AvatarFallback` imports and add `OrganizationSwitcher`, `UserButton` from `@clerk/nextjs`. Replace the avatar markup at the end of the nav with the Clerk components:

```tsx
"use client"

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import { useFeatureFlag } from "@posthog/next"
import { Moon, Sun } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { themeConfig } from "@/config/theme.config"

const ALL_NAV_LINKS = [
  { href: "/analytics", label: "Analytics", flag: null },
  { href: "/ai", label: "AI", flag: "ai-interface" as const },
]

export function TopNav() {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const aiFlag = useFeatureFlag("ai-interface")

  const navLinks = ALL_NAV_LINKS.filter(({ flag }) => {
    if (flag === "ai-interface") return aiFlag?.enabled === true
    return true
  })

  return (
    <nav className="flex h-12 shrink-0 items-center gap-4 bg-nav px-4 text-nav-foreground">
      <span className="font-bold text-sm tracking-tight">{themeConfig.brand.name}</span>
      <div className="flex gap-1">
        {navLinks.map(({ href, label }) => {
          const isActive = pathname?.startsWith(href) ?? false
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 font-medium text-sm transition-colors ${
                isActive
                  ? "bg-nav-foreground/15 text-nav-foreground"
                  : "text-nav-foreground/70 hover:bg-nav-foreground/10 hover:text-nav-foreground"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle colour scheme"
              className="text-nav-foreground hover:bg-nav-foreground/15 hover:text-nav-foreground"
            >
              {/* Exception: dark: classes here are transform utilities (rotate/scale) for icon
                  animation — not colour overrides. The "no dark: overrides" rule targets
                  dark:text-* and dark:bg-* only. */}
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <OrganizationSwitcher />
        <UserButton userProfileUrl="/account" afterSignOutUrl="/" />
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run all web tests**

```bash
just test-web
```

Expected: all tests pass.

- [ ] **Step 5: Run typecheck**

```bash
just typecheck
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/top-nav.tsx apps/web/src/components/ui/TopNav.test.tsx
git commit -m "feat(web): replace hardcoded avatar with Clerk UserButton and OrganizationSwitcher"
```

---

## Task 12: Update environment docs and run full test suite

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add new env vars to `.env.example`**

In `.env.example`, replace the existing Auth section:

```bash
# Auth — set AUTH_MODE=dev for local dev JWT bypass
AUTH_MODE=dev
DEV_JWT_SECRET=dev-secret-change-in-production
# Production Clerk keys (from https://dashboard.clerk.com → API Keys):
# CLERK_SECRET_KEY=sk_...
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
# CLERK_JWT_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
# CLERK_WEBHOOK_SECRET=whsec_...
# NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
# NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/analytics
# NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/analytics
```

- [ ] **Step 2: Run full test suite**

```bash
just test
```

Expected: all tests pass.

- [ ] **Step 3: Run lint and typecheck**

```bash
just lint
just typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs(docs): update .env.example with Clerk env vars for Phase 1"
```

---

## Verification Checklist

Before declaring Phase 1 complete, verify manually with `just dev`:

- [ ] Unauthenticated visit to `/analytics` redirects to `/sign-in`
- [ ] Sign-up creates a user and redirects to `/analytics`
- [ ] Sign-in works with existing account
- [ ] `<OrganizationSwitcher>` appears in nav; can create an org
- [ ] `<UserButton>` → "Manage account" navigates to `/account` with `<UserProfile />`
- [ ] Sign out via `<UserButton>` redirects to `/`
- [ ] Home page `/` is accessible without login
- [ ] API returns 401 for requests without a valid Clerk JWT (test with `curl -X GET http://localhost:8000/api/v1/packages`)
- [ ] API returns 200 in `AUTH_MODE=dev` (default local config)
