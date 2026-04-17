from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection
from src.models.dataset import Dataset
from src.models.field import Field
from src.models.level import Level
from src.models.package import Package
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


async def get_all_for_collections(
    session: AsyncSession, collection_ids: list[int]
) -> list[Dataset]:
    if not collection_ids:
        return []
    return list(
        (
            await session.execute(
                select(Dataset)
                .where(Dataset.collection_id.in_(collection_ids))
                .order_by(Dataset.collection_id, Dataset.sort_order)
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
    all_levels = await get_levels_for_field_ids(session, [f.id for f in fields if f.id is not None])
    levels_by_field: dict[int | None, list[Level]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(lv)
    return [(f, levels_by_field.get(f.id, [])) for f in fields]


async def list_enriched(
    session: AsyncSession,
    collection_id: int | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[int, list[dict]]:
    """Return datasets enriched with collection/package names and counts."""
    field_count_sq = (
        select(Field.dataset_id, func.count().label("field_count"))
        .group_by(Field.dataset_id)
        .subquery()
    )
    response_count_sq = (
        select(Response.dataset_id, func.count().label("response_count"))
        .group_by(Response.dataset_id)
        .subquery()
    )

    stmt = (
        select(
            Dataset,
            Collection.name.label("collection_name"),
            Package.name.label("package_name"),
            func.coalesce(field_count_sq.c.field_count, 0).label("field_count"),
            func.coalesce(response_count_sq.c.response_count, 0).label("response_count"),
        )
        .join(Collection, Dataset.collection_id == Collection.id)
        .join(Package, Collection.package_id == Package.id)
        .outerjoin(field_count_sq, Dataset.id == field_count_sq.c.dataset_id)
        .outerjoin(response_count_sq, Dataset.id == response_count_sq.c.dataset_id)
    )
    if collection_id is not None:
        stmt = stmt.where(Dataset.collection_id == collection_id)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await session.execute(total_stmt)).scalar_one()

    rows = list(
        (
            await session.execute(
                stmt.order_by(Dataset.id.desc()).offset((page - 1) * page_size).limit(page_size)
            )
        ).all()
    )

    items = [
        {
            "id": r.Dataset.id,
            "name": r.Dataset.name,
            "collection_id": r.Dataset.collection_id,
            "collection_name": r.collection_name,
            "package_name": r.package_name,
            "collected_at": r.Dataset.collected_at.isoformat() if r.Dataset.collected_at else None,
            "created_at": r.Dataset.created_at.isoformat(),
            "field_count": r.field_count,
            "response_count": r.response_count,
            "status": "committed",
        }
        for r in rows
    ]
    return total, items


async def get_responses(
    session: AsyncSession, dataset_id: int, page: int = 1, page_size: int = 100
) -> tuple[int, list[Response]]:
    base_stmt = select(Response).where(Response.dataset_id == dataset_id)
    total = (
        await session.execute(
            select(func.count()).select_from(Response).where(Response.dataset_id == dataset_id)
        )
    ).scalar_one()
    items = list(
        (await session.execute(base_stmt.offset((page - 1) * page_size).limit(page_size)))
        .scalars()
        .all()
    )
    return total, items
