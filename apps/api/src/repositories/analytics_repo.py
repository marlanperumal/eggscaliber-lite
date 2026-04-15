from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level

_EXCLUDED_TYPES = {FieldType.identifier, FieldType.weight}


async def get_dataset(session: AsyncSession, dataset_id: int) -> Dataset | None:
    return await session.get(Dataset, dataset_id)


async def get_weight_fields(session: AsyncSession, dataset_id: int) -> list[Field]:
    stmt = (
        select(Field)
        .where(Field.dataset_id == dataset_id, Field.field_type == FieldType.weight)
        .order_by(Field.sort_order)
    )
    return list((await session.execute(stmt)).scalars().all())


async def get_groups_and_fields(
    session: AsyncSession, dataset_id: int
) -> tuple[list[FieldGroup], list[Field]]:
    """Return all FieldGroups and non-excluded Fields for a dataset, ordered by sort_order."""
    groups = list(
        (
            await session.execute(
                select(FieldGroup)
                .where(FieldGroup.dataset_id == dataset_id)
                .order_by(FieldGroup.sort_order)
            )
        )
        .scalars()
        .all()
    )
    fields = list(
        (
            await session.execute(
                select(Field)
                .where(
                    Field.dataset_id == dataset_id,
                    Field.field_type.not_in(_EXCLUDED_TYPES),
                )
                .order_by(Field.sort_order)
            )
        )
        .scalars()
        .all()
    )
    return groups, fields


async def get_field_metas(session: AsyncSession, dataset_id: int, field_keys: list[str]) -> dict:
    fields_stmt = select(Field).where(
        Field.dataset_id == dataset_id,
        Field.field_key.in_(field_keys),
    )
    fields = list((await session.execute(fields_stmt)).scalars().all())

    field_ids = [f.id for f in fields]
    levels_stmt = (
        select(Level)
        .where(Level.field_id.in_(field_ids))
        .order_by(Level.field_id, Level.sort_order)
    )
    all_levels = list((await session.execute(levels_stmt)).scalars().all())

    levels_by_field: dict[int | None, list[dict]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(
            {"value": lv.value, "display_label": lv.display_label}
        )

    return {
        f.field_key: {
            "field_type": f.field_type,
            "display_name": f.display_name,
            "levels": [lv["value"] for lv in levels_by_field.get(f.id, [])],
            "level_labels": {
                lv["value"]: lv["display_label"] for lv in levels_by_field.get(f.id, [])
            },
        }
        for f in fields
    }
