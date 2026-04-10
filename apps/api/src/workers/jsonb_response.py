from collections.abc import Iterator
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.response import Response
from src.workers.base import DataWorker


class JsonbResponseWorker(DataWorker):
    def __init__(self, session: Session) -> None:
        self._session = session

    def fetch(
        self,
        dataset_id: int,
        field_keys: list[str],
        filters: dict[str, Any],
    ) -> Iterator[dict[str, Any]]:
        stmt = select(Response).where(Response.dataset_id == dataset_id)
        for key, value in filters.items():
            stmt = stmt.where(Response.payload[key].astext == str(value))
        rows = self._session.execute(stmt).scalars().all()
        for row in rows:
            if field_keys:
                yield {k: v for k, v in row.payload.items() if k in field_keys}
            else:
                yield dict(row.payload)

    def count(self, dataset_id: int, filters: dict[str, Any]) -> int:
        stmt = select(Response).where(Response.dataset_id == dataset_id)
        for key, value in filters.items():
            stmt = stmt.where(Response.payload[key].astext == str(value))
        return len(self._session.execute(stmt).scalars().all())
