# Async SQLAlchemy Migration

**Date:** 2026-04-13  
**Status:** Ready to implement

## Objective

Migrate the FastAPI backend from synchronous SQLAlchemy to async SQLAlchemy
(`AsyncSession` + `asyncpg`). SQLModel is retained for model declarations and
Pydantic integration only — all session management and query execution moves to
the native async SQLAlchemy API.

## Why

FastAPI is an async framework. The current sync setup runs each DB call in a
threadpool worker (default pool size: 40). Under concurrent load, requests queue
behind the threadpool limit. Async SQLAlchemy allows true non-blocking I/O —
while one request awaits a DB response, others proceed.

The codebase is in a good position for this migration:
- Repos already use `session.execute().scalars()` (native SQLAlchemy API), not
  SQLModel's `session.exec()` — so nothing SQLModel-specific needs unpicking.
- Repos already avoid relationship traversal (explicit multi-step queries) — so
  the lazy-loading footguns are minimal.
- File count is small: ~13 files need changing.

---

## Research findings (sourced during the planning session)

### SQLModel async support
SQLModel has **no async tutorial or AsyncSession** — `/tutorial/fastapi/async/`
returns 404. Its documented patterns are sync-only. In an async setup, SQLModel
is used exclusively for:
- `SQLModel` as base class for model declarations (`table=True`)
- Request/response schemas (Pydantic integration)

Session management and query execution use SQLAlchemy's async API directly.

### FastAPI async DB guidance
FastAPI has no official async SQL guide (`/advanced/async-sql-databases/` is
404). The sync tutorial uses `@app.on_event("startup")` which FastAPI has since
**deprecated** in favour of the `lifespan` context manager. The lifespan pattern
is required for proper engine disposal (see below).

### Alembic async support
Alembic has no native async API but works with an async engine via
`connection.run_sync()`. The `alembic init -t async` template generates the
correct `env.py`. Key facts:
- `do_run_migrations()` stays synchronous — DDL runs through `run_sync`
- Autogenerate works without modification
- Same `postgresql+asyncpg://` URL used by the app works for Alembic
- No separate sync engine needed

---

## Guidelines (what the new patterns doc should say)

### Engine and session — `database.py`

```python
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# Created inside lifespan, not at module level
engine = None
SessionLocal = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, SessionLocal
    engine = create_async_engine(settings.database_url)       # postgresql+asyncpg://
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    yield
    await engine.dispose()   # required — omitting causes "Event loop is closed" warnings


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
```

`expire_on_commit=False` is **required**. Without it, accessing any attribute
after `session.commit()` triggers a lazy-load which raises `MissingGreenlet` in
async context.

Engine and `async_sessionmaker` belong in `lifespan`, not at module level,
because the async engine must be created and disposed within a running event
loop.

### Query patterns — repositories

```python
# Fetch many
result = await session.execute(select(Model).where(...))
rows = result.scalars().all()

# Fetch one or None
result = await session.execute(select(Model).where(Model.id == id))
row = result.scalars().first()

# Fetch by PK
row = await session.get(Model, id)

# Insert
session.add(obj)
await session.commit()
await session.refresh(obj)   # re-reads generated fields (id, created_at, etc.)

# Delete
await session.delete(obj)
await session.commit()

# Count
result = await session.execute(select(func.count()).select_from(Model).where(...))
count = result.scalar_one()
```

### Relationship loading

Lazy loading is **banned** — accessing an unloaded relationship attribute on an
`AsyncSession`-loaded object raises `MissingGreenlet` at runtime.

The two allowed strategies:

**1. Eager loading with `selectinload` (preferred for known access patterns)**
```python
stmt = select(Dataset).options(selectinload(Dataset.fields))
result = await session.execute(stmt)
```

**2. `AsyncAttrs` mixin (escape hatch for one-off traversal)**  
Add `AsyncAttrs` to the declarative base and use `awaitable_attrs` when you need
to traverse a relationship outside the original query:
```python
class Base(AsyncAttrs, DeclarativeBase): ...

# Then on any loaded instance:
fields = await dataset.awaitable_attrs.fields
```

This codebase currently avoids relationship traversal altogether (repos do
explicit multi-step queries). Keep it that way — `selectinload` and
`awaitable_attrs` are documented here as options but the existing pattern of
explicit separate queries is fine and should be continued.

If a `Relationship()` is ever declared on a model, add `lazy="raise"` so
accidental lazy access fails loudly in tests rather than silently in production.

### Route handlers

All route handlers must be `async def`. They `await` service calls; services
`await` repo calls:

```python
@router.get("/datasets/{dataset_id}", response_model=DatasetWithFields)
async def get_dataset(
    dataset_id: int,
    session: AsyncSession = Depends(get_session),
):
    ds = await dataset_repo.get_by_id(session, dataset_id)
    ...
```

The session type annotation changes from `Session` (sqlalchemy.orm) to
`AsyncSession` (sqlalchemy.ext.asyncio).

### Alembic — `env.py`

```python
import asyncio
from sqlalchemy.ext.asyncio import async_engine_from_config
from sqlalchemy.pool import NullPool

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

def run_migrations_online():
    asyncio.run(run_async_migrations())
```

`NullPool` is used so Alembic doesn't hold connections open between commands.
The `sqlalchemy.url` in `alembic.ini` must use `postgresql+asyncpg://`.

### Test fixtures — `conftest.py`

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel

@pytest_asyncio.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(settings.database_url)
    yield engine
    await engine.dispose()

@pytest_asyncio.fixture
async def session(async_engine):
    async with async_engine.connect() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        async_session = async_sessionmaker(conn, expire_on_commit=False)
        async with async_session() as session:
            yield session
            await session.rollback()
```

All test functions that interact with the DB become `async def`. `pytest-asyncio`
must be configured in auto mode in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

### DATABASE_URL format

The connection string must use the `asyncpg` driver prefix:

```
# Before
DATABASE_URL=postgresql://user:pass@host/db

# After
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
```

Update: `.env.local`, `.env.example`, Render environment variable.

---

## Prohibited patterns

```python
# NEVER — SQLModel-only method, does not exist on AsyncSession
session.exec(select(Model))

# NEVER — lazy relationship access raises MissingGreenlet at runtime
obj = await session.get(Dataset, 1)
obj.fields   # ← crash if fields not eager-loaded

# NEVER — sync session in async route
from sqlalchemy.orm import Session    # wrong type
def get_dataset(..., session: Session = Depends(get_session)):  # sync handler

# NEVER — async_scoped_session (SQLAlchemy explicitly discourages for new code)
from sqlalchemy.ext.asyncio import async_scoped_session

# NEVER — engine or sessionmaker created at module level (must be in lifespan)
engine = create_async_engine(...)    # at module scope — wrong
```

---

## Implementation plan

All changes are in `apps/api/`. No frontend changes required.

### Phase 1 — Infrastructure

1. **Install `asyncpg`**
   ```
   uv add asyncpg
   ```

2. **Update `DATABASE_URL`** in `.env.local`, `.env.example` — add `+asyncpg` to
   the scheme. Update Render env var.

3. **Rewrite `apps/api/src/database.py`** — `create_async_engine`,
   `async_sessionmaker`, async `get_session`, `lifespan` context manager with
   `dispose()`.

4. **Update `apps/api/src/main.py`** — wire `lifespan` to the `FastAPI()`
   constructor; remove any `@app.on_event` startup handlers if present.

5. **Update `apps/api/migrations/env.py`** — replace sync engine setup with
   `async_engine_from_config` + `connection.run_sync(do_run_migrations)` pattern.
   Update `alembic.ini` URL to use `postgresql+asyncpg://`.

6. **Update `pyproject.toml`** — set `asyncio_mode = "auto"` for pytest-asyncio.

7. **Install `pytest-asyncio`** if not already present:
   ```
   uv add --dev pytest-asyncio
   ```

8. **Rewrite `apps/api/tests/conftest.py`** — async engine fixture, async session
   fixture with rollback, remove sync session setup.

### Phase 2 — Repositories

Convert all functions to `async def` with `await session.execute()`.
Files: `dataset_repo.py`, `collection_repo.py`, `package_repo.py`,
`analytics_repo.py`.

Each function change is mechanical:
- `def fn(session: Session, ...)` → `async def fn(session: AsyncSession, ...)`
- `session.execute(stmt).scalars().all()` → `await session.execute(stmt)` then
  `.scalars().all()` (the chained `.scalars().all()` stays synchronous — only
  `session.execute` is awaited)
- `session.execute(stmt).scalar_one()` → `(await session.execute(stmt)).scalar_one()`

### Phase 3 — Services

Convert all functions to `async def` and `await` all repo calls.  
Files: `analytics_service.py`, `collection_service.py`.

### Phase 4 — Routes

Convert all route handlers to `async def`. Update `Depends(get_session)` type
annotation from `Session` to `AsyncSession`.  
Files: `datasets.py`, `collections.py`, `packages.py`, `analytics.py`,
`health.py`, `sentry.py`.

(`health.py` and `sentry.py` have no DB access — they only need the `async def`
update if the framework requires uniformity, otherwise leave as sync `def`.)

### Phase 5 — Tests

Rewrite all test functions that use the DB session to `async def`. Update
fixtures as described in Phase 1.

### Phase 6 — Verification

```
just typecheck    # catch remaining sync/async mismatches
just test         # full suite must be green
just lint         # clean
```

### Phase 7 — Update patterns doc

Replace the session/query patterns in `docs/patterns/backend.md` with the async
equivalents from this document. The "Async vs sync route handlers" section added
during the audit-patterns session should be updated — all handlers are now
`async def` (correct for the new async setup).

---

## Files changed

| File | Change |
|---|---|
| `apps/api/src/database.py` | Full rewrite |
| `apps/api/src/main.py` | Wire `lifespan` |
| `apps/api/migrations/env.py` | Async engine pattern |
| `apps/api/alembic.ini` | Update URL scheme |
| `apps/api/tests/conftest.py` | Async fixtures |
| `pyproject.toml` | `asyncio_mode = "auto"` |
| `apps/api/src/repositories/dataset_repo.py` | `async def` + `await` |
| `apps/api/src/repositories/collection_repo.py` | `async def` + `await` |
| `apps/api/src/repositories/package_repo.py` | `async def` + `await` |
| `apps/api/src/repositories/analytics_repo.py` | `async def` + `await` |
| `apps/api/src/services/analytics_service.py` | `async def` + `await` |
| `apps/api/src/services/collection_service.py` | `async def` + `await` |
| `apps/api/src/routes/datasets.py` | `async def` + `AsyncSession` |
| `apps/api/src/routes/collections.py` | `async def` + `AsyncSession` |
| `apps/api/src/routes/packages.py` | `async def` + `AsyncSession` |
| `apps/api/src/routes/analytics.py` | `async def` + `AsyncSession` |
| `.env.local` | `postgresql+asyncpg://` |
| `.env.example` | `postgresql+asyncpg://` |
| `docs/patterns/backend.md` | Update session/query patterns |

`health.py` and `sentry.py` have no DB access and need no changes.

---

## Things that were wrong in the initial writeup (for reference)

1. **Alembic needs a separate sync engine** — Wrong. Alembic uses
   `async_engine_from_config` + `connection.run_sync()`. Same URL, no second
   engine.

2. **`async def` handlers without `await` are fine** — Wrong (and already fixed
   in the audit-patterns session). Sync `def` was correct for the sync setup;
   with async SQLAlchemy, all handlers properly become `async def` because they
   `await` service calls.

3. **Engine created at module level** — Incorrect for async. Must be created
   inside `lifespan` so it runs within the event loop, and disposed on shutdown.
