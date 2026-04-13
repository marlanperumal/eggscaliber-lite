from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.dataset import Dataset
from src.models.field import Field
from src.models.level import Level
from src.models.response import Response


async def get_fields_for_datasets(session: AsyncSession, dataset_ids: list[int]) -> list[Field]:
    if not dataset_ids:
        return []
    return list(
        (
            await session.execute(
                select(Field)
                .where(Field.dataset_id.in_(dataset_ids))
                .order_by(Field.dataset_id, Field.sort_order)
            )
        )
        .scalars()
        .all()
    )


async def get_levels_for_field_ids(session: AsyncSession, field_ids: list[int]) -> list[Level]:
    if not field_ids:
        return []
    return list(
        (
            await session.execute(
                select(Level)
                .where(Level.field_id.in_(field_ids))
                .order_by(Level.field_id, Level.sort_order)
            )
        )
        .scalars()
        .all()
    )


async def get_by_id(session: AsyncSession, dataset_id: int) -> Dataset | None:
    return (
        (await session.execute(select(Dataset).where(Dataset.id == dataset_id))).scalars().first()
    )


async def get_fields_with_levels(
    session: AsyncSession, dataset_id: int
) -> list[tuple[Field, list[Level]]]:
    fields = list(
        (
            await session.execute(
                select(Field).where(Field.dataset_id == dataset_id).order_by(Field.sort_order)
            )
        )
        .scalars()
        .all()
    )
    all_levels = await get_levels_for_field_ids(session, [f.id for f in fields])
    levels_by_field: dict[int, list[Level]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(lv)
    return [(f, levels_by_field.get(f.id, [])) for f in fields]


async def get_responses(
    session: AsyncSession, dataset_id: int, page: int = 1, page_size: int = 100
) -> tuple[int, list[Response]]:
    base_stmt = select(Response).where(Response.dataset_id == dataset_id)
    total = (
        await session.execute(
            select(func.count()).select_from(Response).where(Response.dataset_id == dataset_id)
        )
    ).scalar_one()
    items = (
        (await session.execute(base_stmt.offset((page - 1) * page_size).limit(page_size)))
        .scalars()
        .all()
    )
    return total, items
