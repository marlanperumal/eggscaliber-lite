from dataclasses import dataclass
from enum import StrEnum

from sqlalchemy.orm import Session

from src.errors import CollectionNotFoundError
from src.models.collection import CollectionWithDatasets
from src.models.field import FieldType
from src.repositories import collection_repo, dataset_repo


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


def get_with_datasets(session: Session, collection_id: int) -> CollectionWithDatasets:
    """Raises CollectionNotFoundError if collection_id does not exist."""
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    datasets = collection_repo.get_datasets_for_collection(session, collection_id)
    return CollectionWithDatasets(**col.model_dump(), datasets=datasets)


def get_consistency(session: Session, collection_id: int) -> list[FieldInconsistency]:
    """Raises CollectionNotFoundError if collection_id does not exist.
    Wraps check_field_consistency with the existence check."""
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    return check_field_consistency(collection_id, session)


def check_field_consistency(collection_id: int, session: Session) -> list[FieldInconsistency]:
    datasets = collection_repo.get_datasets_for_collection(session, collection_id)

    if len(datasets) <= 1:
        return []

    all_fields = dataset_repo.get_fields_for_datasets(session, [ds.id for ds in datasets])
    all_levels = dataset_repo.get_levels_for_field_ids(session, [f.id for f in all_fields])

    levels_by_field: dict[int, list[str]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(lv.value)

    # Build {field_key: {dataset_id: (field_type, frozenset[level_values])}}
    field_map: dict[str, dict[int, tuple[FieldType, frozenset[str]]]] = {}
    for f in all_fields:
        level_values = frozenset(levels_by_field.get(f.id, []))
        field_map.setdefault(f.field_key, {})[f.dataset_id] = (f.field_type, level_values)

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
