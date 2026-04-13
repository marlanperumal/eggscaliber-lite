from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.field import Field
from src.models.level import Level
from src.models.response import Response


def get_fields_for_datasets(session: Session, dataset_ids: list[int]) -> list[Field]:
    if not dataset_ids:
        return []
    return list(
        session.execute(
            select(Field)
            .where(Field.dataset_id.in_(dataset_ids))
            .order_by(Field.dataset_id, Field.sort_order)
        )
        .scalars()
        .all()
    )


def get_levels_for_field_ids(session: Session, field_ids: list[int]) -> list[Level]:
    if not field_ids:
        return []
    return list(
        session.execute(
            select(Level)
            .where(Level.field_id.in_(field_ids))
            .order_by(Level.field_id, Level.sort_order)
        )
        .scalars()
        .all()
    )


def get_by_id(session: Session, dataset_id: int) -> Dataset | None:
    return session.execute(select(Dataset).where(Dataset.id == dataset_id)).scalars().first()


def get_fields_with_levels(session: Session, dataset_id: int) -> list[tuple[Field, list[Level]]]:
    fields = list(
        session.execute(
            select(Field).where(Field.dataset_id == dataset_id).order_by(Field.sort_order)
        )
        .scalars()
        .all()
    )
    all_levels = get_levels_for_field_ids(session, [f.id for f in fields])
    levels_by_field: dict[int, list[Level]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(lv)
    return [(f, levels_by_field.get(f.id, [])) for f in fields]


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
