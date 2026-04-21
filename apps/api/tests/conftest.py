import asyncio
from typing import cast

import pytest
import pytest_asyncio
import src.models  # noqa: F401 — ensures all table metadata is registered before create_all
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel
from src.auth import CurrentUser, get_current_user
from src.config import settings
from src.database import get_session
from src.main import app
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.group import PackageCollection
from src.models.package import Package


@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def async_engine():
    engine = create_async_engine(settings.async_test_database_url)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db(async_engine):
    async with async_engine.connect() as conn:
        await conn.begin()
        await conn.begin_nested()
        session_factory = async_sessionmaker(
            conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        async with session_factory() as session:
            yield session
            await session.rollback()
        await conn.rollback()


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
async def seeded_package(db: AsyncSession):
    """A single Package, ready for route-level tests that need only a package."""
    pkg = Package(name="Seeded Package", slug="seeded-pkg-fixture")
    db.add(pkg)
    await db.flush()
    await db.refresh(pkg)
    return pkg


@pytest_asyncio.fixture
async def seeded_collection(db: AsyncSession, seeded_package):
    """A Collection under seeded_package, ready for route-level tests."""
    col = Collection(
        name="Seeded Collection",
        slug="seeded-col-fixture",
        collection_type=CollectionType.survey,
    )
    db.add(col)
    await db.flush()
    await db.refresh(col)

    pc = PackageCollection(package_id=cast(int, seeded_package.id), collection_id=cast(int, col.id))
    db.add(pc)
    await db.flush()
    return col
