from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.field_group import FieldGroup
from src.models.level import Level

_EXCLUDED_TYPES = {FieldType.identifier, FieldType.weight}


def get_dataset(session: Session, dataset_id: int) -> Dataset | None:
    return session.get(Dataset, dataset_id)


def get_weight_fields(session: Session, dataset_id: int) -> list[Field]:
    stmt = (
        select(Field)
        .where(Field.dataset_id == dataset_id, Field.field_type == FieldType.weight)
        .order_by(Field.sort_order)
    )
    return list(session.execute(stmt).scalars().all())


def get_field_tree(session: Session, dataset_id: int) -> dict:
    groups_stmt = (
        select(FieldGroup)
        .where(FieldGroup.dataset_id == dataset_id)
        .order_by(FieldGroup.sort_order)
    )
    all_groups = list(session.execute(groups_stmt).scalars().all())

    fields_stmt = (
        select(Field)
        .where(
            Field.dataset_id == dataset_id,
            Field.field_type.not_in(_EXCLUDED_TYPES),
        )
        .order_by(Field.sort_order)
    )
    all_fields = list(session.execute(fields_stmt).scalars().all())

    def _field_dict(f: Field) -> dict:
        return {
            "id": f.id,
            "field_key": f.field_key,
            "display_name": f.display_name,
            "field_type": f.field_type,
            "sort_order": f.sort_order,
            "is_filterable": f.is_filterable,
        }

    def _group_dict(g: FieldGroup, groups_by_parent: dict, fields_by_group: dict) -> dict:
        children = [
            _group_dict(child, groups_by_parent, fields_by_group)
            for child in groups_by_parent.get(g.id, [])
        ]
        return {
            "id": g.id,
            "name": g.name,
            "slug": g.slug,
            "sort_order": g.sort_order,
            "fields": [_field_dict(f) for f in fields_by_group.get(g.id, [])],
            "children": children,
        }

    groups_by_parent: dict[int | None, list[FieldGroup]] = {}
    for g in all_groups:
        groups_by_parent.setdefault(g.parent_id, []).append(g)

    fields_by_group: dict[int | None, list[Field]] = {}
    for f in all_fields:
        fields_by_group.setdefault(f.group_id, []).append(f)

    top_level_groups = groups_by_parent.get(None, [])

    return {
        "groups": [_group_dict(g, groups_by_parent, fields_by_group) for g in top_level_groups],
        "ungrouped_fields": [_field_dict(f) for f in fields_by_group.get(None, [])],
    }


def get_field_metas(session: Session, dataset_id: int, field_keys: list[str]) -> dict:
    fields_stmt = select(Field).where(
        Field.dataset_id == dataset_id,
        Field.field_key.in_(field_keys),
    )
    fields = list(session.execute(fields_stmt).scalars().all())

    field_ids = [f.id for f in fields]
    levels_stmt = (
        select(Level)
        .where(Level.field_id.in_(field_ids))
        .order_by(Level.field_id, Level.sort_order)
    )
    all_levels = list(session.execute(levels_stmt).scalars().all())

    levels_by_field: dict[int, list[str]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(lv.value)

    return {
        f.field_key: {
            "field_type": f.field_type,
            "display_name": f.display_name,
            "levels": levels_by_field.get(f.id, []),
        }
        for f in fields
    }
