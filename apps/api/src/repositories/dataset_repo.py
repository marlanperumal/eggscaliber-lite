from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.field import Field
from src.models.level import Level
from src.models.response import Response


def get_by_id(session: Session, dataset_id: int) -> Dataset | None:
    return session.execute(select(Dataset).where(Dataset.id == dataset_id)).scalars().first()


def get_fields_with_levels(session: Session, dataset_id: int) -> list[tuple[Field, list[Level]]]:
    fields = (
        session.execute(
            select(Field).where(Field.dataset_id == dataset_id).order_by(Field.sort_order)
        )
        .scalars()
        .all()
    )
    result = []
    for f in fields:
        levels = (
            session.execute(select(Level).where(Level.field_id == f.id).order_by(Level.sort_order))
            .scalars()
            .all()
        )
        result.append((f, levels))
    return result


def get_responses(
    session: Session, dataset_id: int, page: int = 1, page_size: int = 100
) -> tuple[int, list[Response]]:
    base_stmt = select(Response).where(Response.dataset_id == dataset_id)
    total = session.execute(
        select(func.count()).select_from(Response).where(Response.dataset_id == dataset_id)
    ).scalar_one()
    items = (
        session.execute(base_stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()
    )
    return total, items
