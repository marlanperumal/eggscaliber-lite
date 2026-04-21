import re

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import CollectionNotFoundError, PackageNotFoundError
from src.models.collection import (
    CollectionCreate,
    CollectionRead,
    CollectionWithDatasets,
    DatasetSummary,
    InconsistencyOut,
    InconsistencyType,
)
from src.models.field import FieldType
from src.repositories import collection_repo, dataset_repo, package_repo


def _slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


async def create_collection(session: AsyncSession, body: CollectionCreate) -> CollectionRead:
    """Raises PackageNotFoundError if body.package_id does not exist."""
    pkg = await package_repo.get_by_id(session, body.package_id)
    if pkg is None:
        raise PackageNotFoundError(body.package_id)
    slug = body.slug or _slugify(body.name)
    col = await collection_repo.create_collection(
        session,
        name=body.name,
        slug=slug,
        package_id=body.package_id,
        description=body.description,
        collection_type=body.collection_type,
    )
    return CollectionRead.model_validate(col.model_dump())


async def get_with_datasets(
    session: AsyncSession,
    collection_id: int,
    accessible_ids: set[int] | None = None,
) -> CollectionWithDatasets:
    """Raises CollectionNotFoundError if collection_id does not exist or is inaccessible."""
    col = await collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    if accessible_ids is not None:
        pkg_ids = await package_repo.get_package_ids_for_collection(session, collection_id)
        if not pkg_ids & accessible_ids:
            raise CollectionNotFoundError(collection_id)
    datasets = await collection_repo.get_datasets_for_collection(session, collection_id)
    return CollectionWithDatasets.model_validate(
        {
            **col.model_dump(),
            "datasets": [DatasetSummary.model_validate(d.model_dump()) for d in datasets],
        }
    )


async def get_consistency(
    session: AsyncSession,
    collection_id: int,
    accessible_ids: set[int] | None = None,
) -> list[InconsistencyOut]:
    """Raises CollectionNotFoundError if collection_id does not exist or is inaccessible.
    Wraps check_field_consistency with the existence check."""
    col = await collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise CollectionNotFoundError(collection_id)
    if accessible_ids is not None:
        pkg_ids = await package_repo.get_package_ids_for_collection(session, collection_id)
        if not pkg_ids & accessible_ids:
            raise CollectionNotFoundError(collection_id)
    return await check_field_consistency(session, collection_id)


async def check_field_consistency(
    session: AsyncSession, collection_id: int
) -> list[InconsistencyOut]:
    datasets = await collection_repo.get_datasets_for_collection(session, collection_id)

    if len(datasets) <= 1:
        return []

    all_fields = await dataset_repo.get_fields_for_datasets(
        session, [ds.id for ds in datasets if ds.id is not None]
    )
    all_levels = await dataset_repo.get_levels_for_field_ids(
        session, [f.id for f in all_fields if f.id is not None]
    )

    levels_by_field: dict[int | None, list[str]] = {}
    for lv in all_levels:
        levels_by_field.setdefault(lv.field_id, []).append(lv.value)

    # Build {field_key: {dataset_id: (field_type, frozenset[level_values])}}
    field_map: dict[str, dict[int, tuple[FieldType, frozenset[str]]]] = {}
    for f in all_fields:
        level_values = frozenset(levels_by_field.get(f.id, []))
        field_map.setdefault(f.field_key, {})[f.dataset_id] = (f.field_type, level_values)

    dataset_ids = [ds.id for ds in datasets]
    result: list[InconsistencyOut] = []

    for field_key, by_dataset in field_map.items():
        # Missing field
        for did in dataset_ids:
            if did not in by_dataset:
                result.append(
                    InconsistencyOut(
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
                InconsistencyOut(
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
                    InconsistencyOut(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.level_added,
                        detail=(f"Level '{val}' added in a later dataset for field '{field_key}'"),
                    )
                )
            for val in removed:
                result.append(
                    InconsistencyOut(
                        field_key=field_key,
                        inconsistency_type=InconsistencyType.level_removed,
                        detail=(
                            f"Level '{val}' removed in a later dataset for field '{field_key}'"
                        ),
                    )
                )

    return result
