# MCP Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Eggscaliber analytics via an authenticated MCP server at `/mcp/external`, with PAT management in the web UI.

**Architecture:** A `mcp_external/` module in the FastAPI app hosts a standalone FastMCP instance with 7 hand-crafted tools. Starlette middleware on `external_mcp_app` verifies PATs (SHA-256 hash lookup in `api_tokens` table) and attaches `CurrentUser` to request state. Tools access user identity via `fastmcp.server.dependencies.get_http_request()`. The existing `/mcp` (internal dev) is untouched.

**Tech Stack:** FastAPI, SQLModel, FastMCP 3.2.4+, Starlette BaseHTTPMiddleware, Alembic, Next.js App Router, openapi-fetch, Clerk (`useAuth`)

---

## File Map

**Create (backend):**
- `apps/api/src/models/token.py` — `ApiToken` SQLModel + read/response models
- `apps/api/src/repositories/token_repo.py` — DB ops: create, list, revoke, find_by_hash
- `apps/api/src/services/token_service.py` — generate (hash, prefix), list, revoke
- `apps/api/src/routes/tokens.py` — POST/GET/DELETE `/api/v1/tokens`
- `apps/api/src/mcp_external/__init__.py`
- `apps/api/src/mcp_external/auth.py` — Starlette middleware + `resolve_token_hash`
- `apps/api/src/mcp_external/tools/__init__.py`
- `apps/api/src/mcp_external/tools/browse.py` — list_packages, list_collections, list_datasets, describe_dataset
- `apps/api/src/mcp_external/tools/analyse.py` — describe_field_tree, run_crosstab, run_trend
- `apps/api/src/mcp_external/server.py` — FastMCP instance, middleware, exports `external_mcp_app`
- `apps/api/tests/test_tokens.py`
- `apps/api/tests/test_mcp_auth.py`
- `apps/api/tests/test_mcp_tools.py`

**Modify (backend):**
- `apps/api/src/models/__init__.py` — add ApiToken import
- `apps/api/src/main.py` — include tokens router, mount external_mcp_app

**Create (frontend):**
- `apps/web/src/app/account/components/TokenRevealCallout.tsx`
- `apps/web/src/app/account/components/TokenRevealCallout.stories.tsx`
- `apps/web/src/app/account/components/GenerateTokenForm.tsx`
- `apps/web/src/app/account/components/GenerateTokenForm.stories.tsx`
- `apps/web/src/app/account/components/TokenListRow.tsx`
- `apps/web/src/app/account/components/TokenListRow.stories.tsx`
- `apps/web/src/app/account/components/RevokeConfirmDialog.tsx`
- `apps/web/src/app/account/components/RevokeConfirmDialog.stories.tsx`
- `apps/web/src/app/account/components/ApiTokensSection.tsx`
- `apps/web/src/app/account/components/ApiTokensSection.stories.tsx`

**Modify (frontend):**
- `apps/web/src/app/account/[[...account]]/page.tsx` — add ApiTokensSection below UserProfile

---

## Task 1: `ApiToken` model + migration

**Files:**
- Create: `apps/api/src/models/token.py`
- Modify: `apps/api/src/models/__init__.py`
- Create: Alembic migration (via `just db-migration`)

- [ ] **Step 1: Write the model**

```python
# apps/api/src/models/token.py
from datetime import datetime

from sqlmodel import Field, SQLModel


class ApiToken(SQLModel, table=True):
    __tablename__ = "api_tokens"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    name: str
    token_hash: str = Field(unique=True, index=True)
    prefix: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: datetime | None = Field(default=None)
    revoked_at: datetime | None = Field(default=None)


class ApiTokenRead(SQLModel):
    id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None = None


class ApiTokenCreated(ApiTokenRead):
    raw_token: str
```

- [ ] **Step 2: Register model in `__init__.py`**

Add to `apps/api/src/models/__init__.py`:

```python
from .token import ApiToken, ApiTokenCreated, ApiTokenRead  # noqa: F401
```

- [ ] **Step 3: Generate the migration**

```bash
just db-migration "add_api_tokens"
```

Open the generated file in `apps/api/migrations/versions/` and verify the `upgrade()` function includes a `CREATE TABLE api_tokens` statement. FastAPI's SQLModel auto-detects it. If the table is missing, check that `src/models/__init__.py` imports `ApiToken` (needed so SQLModel.metadata includes the table).

- [ ] **Step 4: Run the migration**

```bash
just db-migrate
```

Expected: `Running upgrade ... -> <rev>, add_api_tokens`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/models/token.py apps/api/src/models/__init__.py apps/api/migrations/
git commit -m "feat(api): add ApiToken model and migration"
```

---

## Task 2: Token repository

**Files:**
- Create: `apps/api/src/repositories/token_repo.py`

- [ ] **Step 1: Write the repository**

```python
# apps/api/src/repositories/token_repo.py
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.models.token import ApiToken
from src.models.user import User


async def create(
    session: AsyncSession,
    *,
    user_id: int,
    name: str,
    token_hash: str,
    prefix: str,
) -> ApiToken:
    token = ApiToken(user_id=user_id, name=name, token_hash=token_hash, prefix=prefix)
    session.add(token)
    await session.flush()
    await session.refresh(token)
    return token


async def list_active(session: AsyncSession, user_id: int) -> list[ApiToken]:
    result = await session.execute(
        select(ApiToken)
        .where(ApiToken.user_id == user_id, ApiToken.revoked_at.is_(None))
        .order_by(ApiToken.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke(session: AsyncSession, token_id: int, user_id: int) -> ApiToken | None:
    result = await session.execute(
        select(ApiToken).where(
            ApiToken.id == token_id,
            ApiToken.user_id == user_id,
            ApiToken.revoked_at.is_(None),
        )
    )
    token = result.scalars().first()
    if token is None:
        return None
    token.revoked_at = datetime.utcnow()
    await session.flush()
    return token


async def find_by_hash(session: AsyncSession, token_hash: str) -> ApiToken | None:
    result = await session.execute(
        select(ApiToken).where(
            ApiToken.token_hash == token_hash,
            ApiToken.revoked_at.is_(None),
        )
    )
    return result.scalars().first()


async def update_last_used(session: AsyncSession, token_id: int) -> None:
    result = await session.execute(select(ApiToken).where(ApiToken.id == token_id))
    token = result.scalars().first()
    if token:
        token.last_used_at = datetime.utcnow()
        await session.flush()
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/repositories/token_repo.py
git commit -m "feat(api): add token repository"
```

---

## Task 3: Token service

**Files:**
- Modify: `apps/api/src/errors.py` — add `TokenNotFoundError`
- Create: `apps/api/src/services/token_service.py`

- [ ] **Step 1: Add `TokenNotFoundError` to `errors.py`**

Add to `apps/api/src/errors.py` after the last error class:

```python
class TokenNotFoundError(DomainError):
    status_code = 404
    code = "token_not_found"
```

- [ ] **Step 2: Write the service**

```python
# apps/api/src/services/token_service.py
import hashlib
import secrets
from typing import cast

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from src.errors import ForbiddenError, TokenNotFoundError
from src.models.token import ApiTokenCreated, ApiTokenRead
from src.models.user import User
from src.repositories import token_repo


def _generate_raw_token() -> str:
    return f"eggsec_{secrets.token_hex(32)}"


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _prefix(raw: str) -> str:
    return raw[:15]


async def _resolve_user_id(session: AsyncSession, clerk_id: str) -> int:
    result = await session.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalars().first()
    if user is None:
        raise ForbiddenError("User not found")
    return cast(int, user.id)


async def generate(session: AsyncSession, clerk_id: str, name: str) -> ApiTokenCreated:
    user_id = await _resolve_user_id(session, clerk_id)
    raw = _generate_raw_token()
    token = await token_repo.create(
        session,
        user_id=user_id,
        name=name,
        token_hash=_hash_token(raw),
        prefix=_prefix(raw),
    )
    return ApiTokenCreated(
        id=cast(int, token.id),
        name=token.name,
        prefix=token.prefix,
        created_at=token.created_at,
        raw_token=raw,
    )


async def list_tokens(session: AsyncSession, clerk_id: str) -> list[ApiTokenRead]:
    user_id = await _resolve_user_id(session, clerk_id)
    tokens = await token_repo.list_active(session, user_id)
    return [ApiTokenRead.model_validate(t.model_dump()) for t in tokens]


async def revoke(session: AsyncSession, token_id: int, clerk_id: str) -> None:
    user_id = await _resolve_user_id(session, clerk_id)
    revoked = await token_repo.revoke(session, token_id=token_id, user_id=user_id)
    if revoked is None:
        raise TokenNotFoundError()
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/token_service.py
git commit -m "feat(api): add token service"
```

---

## Task 4: Token routes

**Files:**
- Create: `apps/api/src/routes/tokens.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write the route file**

```python
# apps/api/src/routes/tokens.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_current_user
from src.database import get_session
from src.models.token import ApiTokenCreated, ApiTokenRead
from src.services import token_service

router = APIRouter(tags=["tokens"])


class TokenCreate(SQLModel):
    name: str


@router.post("/tokens", response_model=ApiTokenCreated, status_code=201)
async def create_token(
    body: TokenCreate,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new personal access token. The raw token is returned once and never stored."""
    return await token_service.generate(session, current_user.clerk_id, body.name)


@router.get("/tokens", response_model=list[ApiTokenRead])
async def list_tokens(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """List all active API tokens for the current user."""
    return await token_service.list_tokens(session, current_user.clerk_id)


@router.delete("/tokens/{token_id}", status_code=204)
async def revoke_token(
    token_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Revoke an API token. The token is immediately invalidated."""
    await token_service.revoke(session, token_id=token_id, clerk_id=current_user.clerk_id)
```

- [ ] **Step 2: Add to `main.py`**

In `apps/api/src/main.py`, after the existing router imports, add:

```python
from src.routes import (
    tokens,
)
```

And after the existing `app.include_router(groups.router, ...)` line, add:

```python
app.include_router(tokens.router, prefix="/api/v1", dependencies=[Depends(get_current_user)])
```

- [ ] **Step 3: Regenerate types**

```bash
just generate-types
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/tokens.py apps/api/src/main.py packages/shared/api.d.ts
git commit -m "feat(api): add token CRUD routes"
```

---

## Task 5: Token route tests

**Files:**
- Create: `apps/api/tests/test_tokens.py`

- [ ] **Step 1: Write the tests**

```python
# apps/api/tests/test_tokens.py
import hashlib

from src.models.token import ApiToken
from src.models.user import User


async def _make_user(db, clerk_id: str = "test_user") -> User:
    user = User(clerk_id=clerk_id, email=f"{clerk_id}@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def test_create_token_returns_raw_token_and_prefix(client, db):
    await _make_user(db)
    response = await client.post("/api/v1/tokens", json={"name": "Claude Desktop"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Claude Desktop"
    assert data["raw_token"].startswith("eggsec_")
    assert len(data["raw_token"]) == 71  # "eggsec_" (7) + 64 hex chars
    assert data["prefix"] == data["raw_token"][:15]
    assert "raw_token" not in data.get("prefix", "")


async def test_create_token_stores_hash_not_plaintext(client, db):
    await _make_user(db)
    response = await client.post("/api/v1/tokens", json={"name": "Test"})
    assert response.status_code == 201
    raw = response.json()["raw_token"]
    token_id = response.json()["id"]

    from sqlmodel import select
    result = await db.execute(select(ApiToken).where(ApiToken.id == token_id))
    stored = result.scalars().first()
    assert stored is not None
    assert stored.token_hash == hashlib.sha256(raw.encode()).hexdigest()


async def test_list_tokens_returns_active_only(client, db):
    user = await _make_user(db)
    from datetime import datetime

    active = ApiToken(user_id=user.id, name="Active", token_hash="hash1", prefix="eggsec_aaa")
    revoked = ApiToken(
        user_id=user.id,
        name="Revoked",
        token_hash="hash2",
        prefix="eggsec_bbb",
        revoked_at=datetime.utcnow(),
    )
    db.add(active)
    db.add(revoked)
    await db.flush()

    response = await client.get("/api/v1/tokens")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Active"
    assert "raw_token" not in data[0]


async def test_revoke_token_returns_204(client, db):
    user = await _make_user(db)
    token = ApiToken(user_id=user.id, name="MyToken", token_hash="hash3", prefix="eggsec_ccc")
    db.add(token)
    await db.flush()
    await db.refresh(token)

    response = await client.delete(f"/api/v1/tokens/{token.id}")
    assert response.status_code == 204

    response = await client.get("/api/v1/tokens")
    assert len(response.json()) == 0


async def test_revoke_other_users_token_returns_404(client, db):
    await _make_user(db, "test_user")  # the authed user
    other = await _make_user(db, "other_user")
    token = ApiToken(user_id=other.id, name="Other", token_hash="hash4", prefix="eggsec_ddd")
    db.add(token)
    await db.flush()
    await db.refresh(token)

    response = await client.delete(f"/api/v1/tokens/{token.id}")
    assert response.status_code == 404
```

- [ ] **Step 2: Run the tests**

```bash
just test-api -k test_tokens
```

Expected: 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_tokens.py
git commit -m "test(api): add token route tests"
```

---

## Task 6: PAT auth middleware

**Files:**
- Create: `apps/api/src/mcp_external/__init__.py`
- Create: `apps/api/src/mcp_external/auth.py`

- [ ] **Step 1: Create the module**

```python
# apps/api/src/mcp_external/__init__.py
```

- [ ] **Step 2: Write the auth middleware**

```python
# apps/api/src/mcp_external/auth.py
import hashlib

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.auth import CurrentUser
from src.config import settings
from src.database import SessionLocal
from src.models.token import ApiToken
from src.models.user import User
from src.repositories import token_repo


async def resolve_token_hash(session: AsyncSession, token_hash: str) -> CurrentUser | None:
    """Look up a PAT by hash and return CurrentUser if valid. Returns None if invalid/revoked."""
    token = await token_repo.find_by_hash(session, token_hash)
    if token is None:
        return None

    result = await session.execute(select(User).where(User.id == token.user_id))
    user = result.scalars().first()
    if user is None:
        return None

    return CurrentUser(
        clerk_id=user.clerk_id,
        email=user.email,
        org_id=None,  # resolved from DB at access-check time via user.clerk_id
        is_superuser=False,
    )


async def _update_last_used(token_hash: str) -> None:
    assert SessionLocal is not None
    async with SessionLocal() as session:
        result = await session.execute(
            select(ApiToken).where(ApiToken.token_hash == token_hash)
        )
        token = result.scalars().first()
        if token:
            from datetime import datetime
            token.last_used_at = datetime.utcnow()
            await session.commit()


class PATAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if settings.auth_mode == "dev":
            request.state.current_user = CurrentUser(
                clerk_id="dev_user",
                email="dev@example.com",
                org_id=None,
                is_superuser=settings.dev_superuser,
            )
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer eggsec_"):
            return JSONResponse(
                {"error": "Invalid or missing API token"}, status_code=401
            )

        raw_token = auth_header.removeprefix("Bearer ")
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        assert SessionLocal is not None
        async with SessionLocal() as session:
            user = await resolve_token_hash(session, token_hash)

        if user is None:
            return JSONResponse({"error": "Invalid or revoked API token"}, status_code=401)

        request.state.current_user = user

        # fire-and-forget last_used_at update
        import asyncio
        asyncio.ensure_future(_update_last_used(token_hash))

        return await call_next(request)
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/mcp_external/__init__.py apps/api/src/mcp_external/auth.py
git commit -m "feat(api): add PAT auth middleware for external MCP"
```

---

## Task 7: PAT auth tests

**Files:**
- Create: `apps/api/tests/test_mcp_auth.py`

- [ ] **Step 1: Write the tests**

```python
# apps/api/tests/test_mcp_auth.py
import hashlib

from src.mcp_external.auth import resolve_token_hash
from src.models.token import ApiToken
from src.models.user import User


async def _make_user_and_token(db, clerk_id: str = "test_user") -> tuple[User, str]:
    user = User(clerk_id=clerk_id, email=f"{clerk_id}@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    raw = "eggsec_" + "a" * 64
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    token = ApiToken(user_id=user.id, name="Test", token_hash=token_hash, prefix=raw[:15])
    db.add(token)
    await db.flush()
    return user, raw


async def test_resolve_valid_token_returns_current_user(db):
    user, raw = await _make_user_and_token(db)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()

    result = await resolve_token_hash(db, token_hash)
    assert result is not None
    assert result.clerk_id == user.clerk_id
    assert result.email == user.email


async def test_resolve_unknown_hash_returns_none(db):
    result = await resolve_token_hash(db, "nonexistent_hash")
    assert result is None


async def test_resolve_revoked_token_returns_none(db):
    from datetime import datetime

    user = User(clerk_id="revoke_user", email="r@example.com")
    db.add(user)
    await db.flush()
    await db.refresh(user)

    raw = "eggsec_" + "b" * 64
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    token = ApiToken(
        user_id=user.id,
        name="Revoked",
        token_hash=token_hash,
        prefix=raw[:15],
        revoked_at=datetime.utcnow(),
    )
    db.add(token)
    await db.flush()

    result = await resolve_token_hash(db, token_hash)
    assert result is None
```

- [ ] **Step 2: Run the tests**

```bash
just test-api -k test_mcp_auth
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/test_mcp_auth.py
git commit -m "test(api): add PAT auth resolution tests"
```

---

## Task 8: Browse tools

**Files:**
- Create: `apps/api/src/mcp_external/tools/__init__.py`
- Create: `apps/api/src/mcp_external/tools/browse.py`

- [ ] **Step 1: Create `__init__.py`**

```python
# apps/api/src/mcp_external/tools/__init__.py
```

- [ ] **Step 2: Write browse tools**

```python
# apps/api/src/mcp_external/tools/browse.py
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request

from src.auth import CurrentUser, _get_accessible_package_ids
from src.database import SessionLocal
from src.models.collection import CollectionRead
from src.models.dataset import DatasetRead
from src.models.package import PackageRead
from src.services import collection_service, dataset_service, package_service


def _user() -> CurrentUser:
    return get_http_request().state.current_user


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def list_packages() -> list[dict]:
        """List all packages (top-level data groupings) the current user is entitled to access."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            pkgs = await package_service.list_packages(session, accessible_ids)
        return [p.model_dump() for p in pkgs]

    @mcp.tool()
    async def list_collections(package_id: int) -> list[dict]:
        """List all survey collections within a package. Pass the package_id from list_packages."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            pkg = await package_service.get_with_collections(session, package_id, accessible_ids)
        return [c.model_dump() for c in pkg.collections]

    @mcp.tool()
    async def list_datasets(collection_id: int) -> list[dict]:
        """List all datasets within a collection. Pass the collection_id from list_collections."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            page = await dataset_service.list_datasets(
                session, collection_id=collection_id, accessible_ids=accessible_ids
            )
        return [item.model_dump() for item in page.items]

    @mcp.tool()
    async def describe_dataset(dataset_id: int) -> dict:
        """Get metadata for a dataset: title, field count, date range. Use before running analytics."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            ds = await dataset_service.get_with_fields(session, dataset_id, accessible_ids)
        return ds.model_dump()
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/mcp_external/tools/__init__.py apps/api/src/mcp_external/tools/browse.py
git commit -m "feat(api): add MCP external browse tools"
```

---

## Task 9: Analyse tools

**Files:**
- Create: `apps/api/src/mcp_external/tools/analyse.py`

- [ ] **Step 1: Write analyse tools**

```python
# apps/api/src/mcp_external/tools/analyse.py
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request

from src.auth import CurrentUser, _get_accessible_package_ids
from src.database import SessionLocal
from src.models.analytics import CrosstabRequest, MeasureSpec, TrendRequest
from src.services import analytics_service


def _user() -> CurrentUser:
    return get_http_request().state.current_user


def register(mcp: FastMCP) -> None:
    @mcp.tool()
    async def describe_field_tree(dataset_id: int) -> dict:
        """Get the full field tree for a dataset: field keys, display names, types, and groups.
        Use this before run_crosstab to discover valid field_key values."""
        user = _user()
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            from src.services.analytics_service import _assert_dataset_accessible
            await _assert_dataset_accessible(session, dataset_id, accessible_ids)
            tree = await analytics_service.get_field_tree(session, dataset_id)
        return tree.model_dump()

    @mcp.tool()
    async def run_crosstab(
        dataset_id: int,
        row_field_keys: list[str],
        column_field_keys: list[str],
        measure_type: str = "count",
        display: str = "pct_col",
        row_mode: str = "stacked",
        col_mode: str = "stacked",
    ) -> dict:
        """Run a cross-tabulation. Returns a table of row × column frequencies.
        measure_type: 'count' | 'weighted'. display: 'pct_col' | 'pct_row' | 'n'.
        row_mode / col_mode: 'stacked' | 'nested'. Use describe_field_tree to find field_keys."""
        from src.models.analytics import FieldSelection

        user = _user()
        request = CrosstabRequest(
            dataset_id=dataset_id,
            rows=[FieldSelection(field_key=k) for k in row_field_keys],
            columns=[FieldSelection(field_key=k) for k in column_field_keys],
            row_mode=row_mode,  # type: ignore[arg-type]
            col_mode=col_mode,  # type: ignore[arg-type]
            measure=MeasureSpec(type=measure_type, display=display),  # type: ignore[arg-type]
        )
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            result = await analytics_service.run_crosstab(session, request, accessible_ids)
        return result.model_dump()

    @mcp.tool()
    async def run_trend(
        collection_id: int,
        field_keys: list[str],
        measure_type: str = "count",
        display: str = "pct_col",
    ) -> dict:
        """Track how a field's distribution changes across datasets in a collection over time.
        Use list_datasets to confirm the collection has multiple datasets before calling."""
        from src.models.analytics import FieldSelection

        user = _user()
        request = TrendRequest(
            collection_id=collection_id,
            fields=[FieldSelection(field_key=k) for k in field_keys],
            measure=MeasureSpec(type=measure_type, display=display),  # type: ignore[arg-type]
        )
        assert SessionLocal is not None
        async with SessionLocal() as session:
            accessible_ids = await _get_accessible_package_ids(user, session)
            result = await analytics_service.run_trend(session, request, accessible_ids)
        return result.model_dump()
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/mcp_external/tools/analyse.py
git commit -m "feat(api): add MCP external analyse tools"
```

---

## Task 10: External MCP server + `main.py` mount

**Files:**
- Create: `apps/api/src/mcp_external/server.py`
- Modify: `apps/api/src/main.py`

- [ ] **Step 1: Write `server.py`**

```python
# apps/api/src/mcp_external/server.py
from fastmcp import FastMCP
from fastmcp.utilities.lifespan import combine_lifespans

from src.mcp_external.auth import PATAuthMiddleware
from src.mcp_external.tools import browse, analyse

external_mcp = FastMCP(name="Eggscaliber External")

browse.register(external_mcp)
analyse.register(external_mcp)

external_mcp_app = external_mcp.http_app(path="/")
external_mcp_app.add_middleware(PATAuthMiddleware)
```

- [ ] **Step 2: Update `main.py`**

Add import near the top (with other route imports):

```python
from src.mcp_external.server import external_mcp_app
```

After `app.mount("/mcp", mcp_app)`, add:

```python
app.mount("/mcp/external", external_mcp_app)
```

Update `combine_lifespans` line to include the new lifespan:

```python
app.router.lifespan_context = combine_lifespans(db_lifespan, mcp_app.lifespan, external_mcp_app.lifespan)
```

- [ ] **Step 3: Start the API and verify both MCP endpoints exist**

```bash
just api
```

In another terminal:
```bash
curl http://localhost:8000/mcp/external/
curl http://localhost:8000/mcp/
```

Both should return valid MCP responses (JSON with server info or empty 200/404 — exact response depends on MCP protocol). No 500 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/mcp_external/server.py apps/api/src/main.py
git commit -m "feat(api): mount external MCP server at /mcp/external"
```

---

## Task 11: External MCP tool tests

**Files:**
- Create: `apps/api/tests/test_mcp_tools.py`

- [ ] **Step 1: Write the tests**

```python
# apps/api/tests/test_mcp_tools.py
"""Tests for external MCP tool logic.

We test the service calls that tools make, using the real DB fixtures.
Tools themselves call _get_accessible_package_ids → package_service → etc.
We verify that access filtering works correctly.
"""
from typing import cast

from src.auth import CurrentUser, _get_accessible_package_ids
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection
from src.models.package import Package
from src.services import package_service, dataset_service, collection_service, analytics_service


async def _setup_accessible_package(db) -> tuple[Package, Collection, Dataset]:
    pkg = Package(name="Accessible Pkg", slug="accessible-pkg")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)

    col = Collection(name="Col A", slug="col-a", collection_type=CollectionType.survey)
    db.add(col)
    await db.flush()
    await db.refresh(col)

    db.add(PackageCollection(package_id=cast(int, pkg.id), collection_id=cast(int, col.id)))
    await db.flush()

    ds = Dataset(name="DS 2024", slug="ds-2024", collection_id=col.id, sort_order=0)
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return pkg, col, ds


async def test_list_packages_returns_accessible_packages(db):
    pkg, _, _ = await _setup_accessible_package(db)
    user = CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)
    accessible_ids = await _get_accessible_package_ids(user, db)
    result = await package_service.list_packages(db, accessible_ids)
    names = [p.name for p in result]
    assert "Accessible Pkg" in names


async def test_list_datasets_in_collection(db):
    _, col, ds = await _setup_accessible_package(db)
    user = CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)
    accessible_ids = await _get_accessible_package_ids(user, db)
    page = await dataset_service.list_datasets(
        db, collection_id=cast(int, col.id), accessible_ids=accessible_ids
    )
    assert page.total >= 1
    assert any(item.name == "DS 2024" for item in page.items)


async def test_describe_dataset_returns_metadata(db):
    _, _, ds = await _setup_accessible_package(db)
    user = CurrentUser(clerk_id="dev_user", email="dev@example.com", org_id=None)
    accessible_ids = await _get_accessible_package_ids(user, db)
    result = await dataset_service.get_with_fields(db, cast(int, ds.id), accessible_ids)
    assert result.name == "DS 2024"
```

- [ ] **Step 2: Run the tests**

```bash
just test-api -k test_mcp_tools
```

Expected: 3 tests pass.

- [ ] **Step 3: Run the full test suite**

```bash
just test-api
```

Expected: all existing tests pass + new tests.

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/test_mcp_tools.py
git commit -m "test(api): add external MCP tool tests"
```

---

## Task 12: Install missing shadcn components

**Files:** none (adds shadcn components to the design system)

- [ ] **Step 1: Install `alert-dialog` and `label`**

```bash
just storybook
```

In a second terminal:

```bash
pnpm --filter web dlx shadcn@latest add alert-dialog label
```

This generates `apps/web/src/components/ui/alert-dialog.tsx` and `apps/web/src/components/ui/label.tsx`.

- [ ] **Step 2: Commit the new components**

```bash
git add apps/web/src/components/ui/alert-dialog.tsx apps/web/src/components/ui/label.tsx
git commit -m "feat(web): add alert-dialog and label shadcn components"
```

---

## Task 14: `TokenRevealCallout` component

**Files:**
- Create: `apps/web/src/app/account/components/TokenRevealCallout.tsx`
- Create: `apps/web/src/app/account/components/TokenRevealCallout.stories.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/account/components/TokenRevealCallout.tsx
"use client"
import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  rawToken: string
  onDismiss: () => void
}

export function TokenRevealCallout({ rawToken, onDismiss }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-warning/40 bg-warning/10 p-4 space-y-3"
    >
      <p className="text-sm font-medium text-foreground">
        Copy your token now — it won&apos;t be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code
          data-testid="raw-token"
          className="flex-1 rounded bg-muted px-3 py-2 font-mono text-xs text-foreground break-all"
        >
          {rawToken}
        </code>
        <Button
          variant="outline"
          size="icon"
          aria-label={copied ? "Copied" : "Copy token"}
          onClick={handleCopy}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Done
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Write the story**

```tsx
// apps/web/src/app/account/components/TokenRevealCallout.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenRevealCallout } from "./TokenRevealCallout"

const meta: Meta<typeof TokenRevealCallout> = {
  title: "Account/TokenRevealCallout",
  component: TokenRevealCallout,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    rawToken: "eggsec_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
    onDismiss: () => {},
  },
}
export default meta
type Story = StoryObj<typeof TokenRevealCallout>

export const Default: Story = {}
```

- [ ] **Step 3: Verify in Storybook**

```bash
just storybook
```

Open http://localhost:6006 → Account/TokenRevealCallout. Check a11y tab — no violations.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/account/components/TokenRevealCallout.tsx apps/web/src/app/account/components/TokenRevealCallout.stories.tsx
git commit -m "feat(web): add TokenRevealCallout component"
```

---

## Task 15: `GenerateTokenForm` component

**Files:**
- Create: `apps/web/src/app/account/components/GenerateTokenForm.tsx`
- Create: `apps/web/src/app/account/components/GenerateTokenForm.stories.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/account/components/GenerateTokenForm.tsx
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  onGenerate: (name: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function GenerateTokenForm({ onGenerate, onCancel, isLoading = false }: Props) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Token name is required")
      return
    }
    setError(null)
    await onGenerate(trimmed)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="token-name">Token name</Label>
        <Input
          id="token-name"
          placeholder="e.g. Claude Desktop"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          aria-describedby={error ? "token-name-error" : undefined}
        />
        {error && (
          <p id="token-name-error" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Generating…" : "Generate"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Write the story**

```tsx
// apps/web/src/app/account/components/GenerateTokenForm.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { GenerateTokenForm } from "./GenerateTokenForm"

const meta: Meta<typeof GenerateTokenForm> = {
  title: "Account/GenerateTokenForm",
  component: GenerateTokenForm,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    onGenerate: async () => {},
    onCancel: () => {},
    isLoading: false,
  },
}
export default meta
type Story = StoryObj<typeof GenerateTokenForm>

export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
```

- [ ] **Step 3: Verify in Storybook (a11y)**

```bash
just storybook
```

Open http://localhost:6006 → Account/GenerateTokenForm. Check a11y — no violations.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/account/components/GenerateTokenForm.tsx apps/web/src/app/account/components/GenerateTokenForm.stories.tsx
git commit -m "feat(web): add GenerateTokenForm component"
```

---

## Task 16: `TokenListRow` + `RevokeConfirmDialog` components

**Files:**
- Create: `apps/web/src/app/account/components/TokenListRow.tsx`
- Create: `apps/web/src/app/account/components/TokenListRow.stories.tsx`
- Create: `apps/web/src/app/account/components/RevokeConfirmDialog.tsx`
- Create: `apps/web/src/app/account/components/RevokeConfirmDialog.stories.tsx`

- [ ] **Step 1: Write `RevokeConfirmDialog`**

```tsx
// apps/web/src/app/account/components/RevokeConfirmDialog.tsx
"use client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Props {
  open: boolean
  tokenName: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function RevokeConfirmDialog({
  open,
  tokenName,
  isLoading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke &quot;{tokenName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This token will be immediately invalidated. Any clients using it will lose access.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Revoking…" : "Revoke"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Write `TokenListRow`**

```tsx
// apps/web/src/app/account/components/TokenListRow.tsx
"use client"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RevokeConfirmDialog } from "./RevokeConfirmDialog"

interface Props {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt?: string | null
  onRevoke: (id: number) => Promise<void>
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function TokenListRow({ id, name, prefix, createdAt, lastUsedAt, onRevoke }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const handleConfirm = async () => {
    setIsRevoking(true)
    await onRevoke(id)
    setIsRevoking(false)
    setDialogOpen(false)
  }

  return (
    <>
      <div
        data-testid="token-row"
        className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="font-mono text-xs text-muted-foreground">{prefix}…</p>
        </div>
        <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
          <p>Created {relativeTime(createdAt)}</p>
          {lastUsedAt ? (
            <p>Last used {relativeTime(lastUsedAt)}</p>
          ) : (
            <p>Never used</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Revoke token ${name}`}
          onClick={() => setDialogOpen(true)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <RevokeConfirmDialog
        open={dialogOpen}
        tokenName={name}
        isLoading={isRevoking}
        onConfirm={handleConfirm}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  )
}
```

- [ ] **Step 3: Write stories**

```tsx
// apps/web/src/app/account/components/RevokeConfirmDialog.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { RevokeConfirmDialog } from "./RevokeConfirmDialog"

const meta: Meta<typeof RevokeConfirmDialog> = {
  title: "Account/RevokeConfirmDialog",
  component: RevokeConfirmDialog,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    open: true,
    tokenName: "Claude Desktop",
    isLoading: false,
    onConfirm: () => {},
    onCancel: () => {},
  },
}
export default meta
type Story = StoryObj<typeof RevokeConfirmDialog>

export const Default: Story = {}
export const Loading: Story = { args: { isLoading: true } }
```

```tsx
// apps/web/src/app/account/components/TokenListRow.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { TokenListRow } from "./TokenListRow"

const meta: Meta<typeof TokenListRow> = {
  title: "Account/TokenListRow",
  component: TokenListRow,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    id: 1,
    name: "Claude Desktop",
    prefix: "eggsec_1a2b3c4",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    onRevoke: async () => {},
  },
}
export default meta
type Story = StoryObj<typeof TokenListRow>

export const NeverUsed: Story = {}
export const WithLastUsed: Story = {
  args: { lastUsedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
}
```

- [ ] **Step 4: Verify in Storybook (a11y)**

```bash
just storybook
```

Open http://localhost:6006 → Account/TokenListRow and Account/RevokeConfirmDialog. Check a11y — no violations.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/account/components/TokenListRow.tsx apps/web/src/app/account/components/TokenListRow.stories.tsx apps/web/src/app/account/components/RevokeConfirmDialog.tsx apps/web/src/app/account/components/RevokeConfirmDialog.stories.tsx
git commit -m "feat(web): add TokenListRow and RevokeConfirmDialog components"
```

---

## Task 17: `ApiTokensSection` + account page integration

**Files:**
- Create: `apps/web/src/app/account/components/ApiTokensSection.tsx`
- Create: `apps/web/src/app/account/components/ApiTokensSection.stories.tsx`
- Modify: `apps/web/src/app/account/[[...account]]/page.tsx`

- [ ] **Step 1: Write `ApiTokensSection`**

```tsx
// apps/web/src/app/account/components/ApiTokensSection.tsx
"use client"
import { useAuth } from "@clerk/nextjs"
import type { components } from "@shared/api"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { mutate } from "@/lib/mutate"
import { GenerateTokenForm } from "./GenerateTokenForm"
import { TokenListRow } from "./TokenListRow"
import { TokenRevealCallout } from "./TokenRevealCallout"

type ApiTokenRead = components["schemas"]["ApiTokenRead"]
type ApiTokenCreated = components["schemas"]["ApiTokenCreated"]

export function ApiTokensSection() {
  const { getToken } = useAuth()
  const [tokens, setTokens] = useState<ApiTokenRead[]>([])
  const [showForm, setShowForm] = useState(false)
  const [pendingToken, setPendingToken] = useState<ApiTokenCreated | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const authHeaders = useCallback(async () => {
    const token = await getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [getToken])

  const fetchTokens = useCallback(async () => {
    const headers = await authHeaders()
    const { data } = await api.GET("/api/v1/tokens", { headers })
    if (data) setTokens(data)
  }, [authHeaders])

  useEffect(() => { fetchTokens() }, [fetchTokens])

  const handleGenerate = async (name: string) => {
    setIsGenerating(true)
    const headers = await authHeaders()
    const { data } = await mutate(() =>
      api.POST("/api/v1/tokens", { body: { name }, headers }),
      { errorMessage: "Failed to generate token" }
    )
    setIsGenerating(false)
    if (data) {
      setPendingToken(data)
      setShowForm(false)
      await fetchTokens()
    }
  }

  const handleRevoke = async (id: number) => {
    const headers = await authHeaders()
    await mutate(
      () => api.DELETE("/api/v1/tokens/{token_id}", { params: { path: { token_id: id } }, headers }),
      { errorMessage: "Failed to revoke token" }
    )
    await fetchTokens()
  }

  return (
    <section className="space-y-4" aria-labelledby="api-tokens-heading">
      <div className="flex items-center justify-between">
        <h2 id="api-tokens-heading" className="text-lg font-semibold text-foreground">
          API Tokens
        </h2>
        {!showForm && !pendingToken && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            New Token
          </Button>
        )}
      </div>

      {pendingToken && (
        <TokenRevealCallout
          rawToken={pendingToken.raw_token}
          onDismiss={() => setPendingToken(null)}
        />
      )}

      {showForm && (
        <GenerateTokenForm
          onGenerate={handleGenerate}
          onCancel={() => setShowForm(false)}
          isLoading={isGenerating}
        />
      )}

      {tokens.length === 0 && !showForm && !pendingToken ? (
        <p className="text-sm text-muted-foreground">
          No active tokens. Generate one to connect Claude Desktop or Claude Code.
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <TokenListRow
              key={token.id}
              id={token.id}
              name={token.name}
              prefix={token.prefix}
              createdAt={token.created_at}
              lastUsedAt={token.last_used_at}
              onRevoke={handleRevoke}
            />
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-foreground">Connect with Claude Code</p>
        <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs text-foreground">
{`{
  "eggscaliber": {
    "type": "http",
    "url": "https://eggscaliber-lite-api.onrender.com/mcp/external",
    "headers": { "Authorization": "Bearer <your-token>" }
  }
}`}
        </pre>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Write the story**

```tsx
// apps/web/src/app/account/components/ApiTokensSection.stories.tsx
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ApiTokensSection } from "./ApiTokensSection"

const meta: Meta<typeof ApiTokensSection> = {
  title: "Account/ApiTokensSection",
  component: ApiTokensSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
}
export default meta
type Story = StoryObj<typeof ApiTokensSection>

export const Default: Story = {}
```

Note: This story requires the dev API (`just api`) to load real tokens. Add a Storybook decorator or mock for CI if needed — see the pattern in `AnalyticsPage.stories.tsx`.

- [ ] **Step 3: Update account page**

Replace `apps/web/src/app/account/[[...account]]/page.tsx`:

```tsx
import { UserProfile } from "@clerk/nextjs"
import { ApiTokensSection } from "../components/ApiTokensSection"

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <UserProfile />
      <ApiTokensSection />
    </div>
  )
}
```

- [ ] **Step 4: Verify Storybook builds cleanly**

```bash
just build-storybook
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/account/components/ApiTokensSection.tsx apps/web/src/app/account/components/ApiTokensSection.stories.tsx apps/web/src/app/account/[[...account]]/page.tsx
git commit -m "feat(web): add ApiTokensSection and wire into account page"
```

---

## Task 18: Pre-push checks + final verification

- [ ] **Step 1: Run the full CI pipeline locally**

```bash
just lint && just format-check && just typecheck && just build-storybook && just test
```

Fix any issues before proceeding.

- [ ] **Step 2: Smoke-test the external MCP endpoint**

Start the stack:
```bash
just dev
```

Generate a token via the account page at http://localhost:3000/account, then verify the MCP endpoint accepts it:

```bash
curl -H "Authorization: Bearer <your-token>" http://localhost:8000/mcp/external/
```

- [ ] **Step 3: Verify the internal MCP is unaffected**

```bash
curl http://localhost:8000/mcp/
```

Should respond as before (no auth required in dev mode).

- [ ] **Step 4: Push**

```bash
git push
```
