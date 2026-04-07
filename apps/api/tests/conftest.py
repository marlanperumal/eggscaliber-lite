import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from src.config import settings
from src.database import get_session
from src.main import app


@pytest.fixture(scope="session")
def engine():
    test_engine = create_engine(settings.test_database_url)
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
