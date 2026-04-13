from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.response import Response
from src.workers.base import DataWorker


class JsonbResponseWorker(DataWorker):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def fetch(
        self,
        dataset_id: int,
        field_keys: list[str],
        filters: dict[str, Any],
    ) -> list[dict[str, Any]]:
        stmt = select(Response).where(Response.dataset_id == dataset_id)
        for key, value in filters.items():
            stmt = stmt.where(Response.payload[key].astext == str(value))
        rows = (await self._session.execute(stmt)).scalars().all()
        if field_keys:
            return [{k: v for k, v in row.payload.items() if k in field_keys} for row in rows]
        return [dict(row.payload) for row in rows]

    async def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        stmt = select(func.count()).select_from(Response).where(Response.dataset_id == dataset_id)
        for key, value in filters.items():
            stmt = stmt.where(Response.payload[key].astext == str(value))
        return (await self._session.execute(stmt)).scalar_one()
