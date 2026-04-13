import pytest
import src.models  # noqa: F401 — ensures all table metadata is registered before create_all
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlmodel import SQLModel
from src.config import settings
from src.database import get_session
from src.main import app
from src.models.collection import Collection, CollectionType
from src.models.dataset import Dataset
from src.models.package import Package


@pytest.fixture(scope="session")
def engine():
    test_engine = create_engine(settings.test_database_url)
    SQLModel.metadata.drop_all(test_engine)
    SQLModel.metadata.create_all(test_engine)
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def db(engine):
    connection = engine.connect()
    transaction = connection.begin()
    session_factory = sessionmaker(bind=connection)
    session = session_factory()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session):
    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def bare_dataset(db):
    """Minimal Package → Collection → Dataset chain. Tests can add fields/responses on top."""
    pkg = Package(name="Test Package", slug="test-pkg-fixture")
    db.add(pkg)
    db.flush()
    db.refresh(pkg)

    col = Collection(
        name="Test Collection",
        slug="test-col-fixture",
        package_id=pkg.id,
        collection_type=CollectionType.survey,
    )
    db.add(col)
    db.flush()
    db.refresh(col)

    ds = Dataset(name="Test Dataset", slug="test-ds-fixture", collection_id=col.id, sort_order=0)
    db.add(ds)
    db.flush()
    db.refresh(ds)
    return ds
