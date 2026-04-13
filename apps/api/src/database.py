from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import settings

engine: AsyncEngine | None = None
SessionLocal: async_sessionmaker[AsyncSession] | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine, SessionLocal
    engine = create_async_engine(settings.async_database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    yield
    await engine.dispose()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    assert SessionLocal is not None
    async with SessionLocal() as session:
        yield session
