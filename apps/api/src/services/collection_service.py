from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.dataset import Dataset
from src.models.field import Field, FieldType
from src.models.level import Level


class InconsistencyType(StrEnum):
    type_mismatch = "type_mismatch"
    level_added = "level_added"
    level_removed = "level_removed"
    missing_field = "missing_field"


@dataclass
class FieldInconsistency:
    field_key: str
    inconsistency_type: InconsistencyType
    detail: str


def check_field_consistency(collection_id: int, session: Session) -> list[FieldInconsistency]:
    datasets = (
        session.execute(
            select(Dataset)
            .where(Dataset.collection_id == collection_id)
            .order_by(Dataset.sort_order)
        )
        .scalars()
        .all()
    )

    if len(datasets) <= 1:
        return []

    # Build {field_key: {dataset_id: (field_type, frozenset[level_values])}}
    field_map: dict[str, dict[int, tuple[FieldType, frozenset[str]]]] = {}
    for ds in datasets:
        fields = session.execute(select(Field).where(Field.dataset_id == ds.id)).scalars().all()
        for f in fields:
            levels = session.execute(select(Level).where(Level.field_id == f.id)).scalars().all()
            level_values = frozenset(lv.value for lv in levels)
            field_map.setdefault(f.field_key, {})[ds.id] = (f.field_type, level_values)

    dataset_ids = [ds.id for ds in datasets]
    result: list[FieldInconsistency] = []

    for field_key, by_dataset in field_map.items():
        # Missing field
        for did in dataset_ids:
            if did not in by_dataset:
                result.append(
                    FieldInconsistency(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.missing_field,
                        detail=f"Field '{field_key}' absent from dataset {did}",
                    )
                )

        present = list(by_dataset.values())
        if not present:
            continue

        # Type mismatch
        types = {ft for ft, _ in present}
        if len(types) > 1:
            result.append(
                FieldInconsistency(
                    field_key=field_key,
                    inconsistency_type=InconsistencyType.type_mismatch,
                    detail=(
                        f"Field '{field_key}' has conflicting types: "
                        f"{', '.join(t.value for t in types)}"
                    ),
                )
            )

        # Level inconsistency — compare consecutive dataset pairs
        ordered_levels = [by_dataset[did][1] for did in dataset_ids if did in by_dataset]
        for prev, later in zip(ordered_levels, ordered_levels[1:], strict=False):
            added = later - prev
            removed = prev - later
            for val in added:
                result.append(
                    FieldInconsistency(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.level_added,
                        detail=(f"Level '{val}' added in a later dataset for field '{field_key}'"),
                    )
                )
            for val in removed:
                result.append(
                    FieldInconsistency(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.level_removed,
                        detail=(
                            f"Level '{val}' removed in a later dataset for field '{field_key}'"
                        ),
                    )
                )

    return result
