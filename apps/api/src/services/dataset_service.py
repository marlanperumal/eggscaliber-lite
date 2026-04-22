from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import DatasetNotFoundError
from src.models.dataset import DatasetListPage, DatasetWithFields, FieldWithLevels, LevelOut
from src.models.response import Response, ResponsePage, ResponseRead
from src.repositories import dataset_repo, package_repo


async def list_datasets(
    session: AsyncSession,
    collection_id: int | None = None,
    page: int = 1,
    page_size: int = 50,
    accessible_ids: set[int] | None = None,
) -> DatasetListPage:
    total, items = await dataset_repo.list_enriched(
        session,
        collection_id=collection_id,
        page=page,
        page_size=page_size,
        accessible_package_ids=accessible_ids,
    )
    return DatasetListPage(total=total, page=page, page_size=page_size, items=items)


async def get_with_fields(
    session: AsyncSession, dataset_id: int, accessible_ids: set[int] | None = None
) -> DatasetWithFields:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    if accessible_ids is not None:
        pkg_ids = await package_repo.get_package_ids_for_dataset(session, dataset_id)
        if not pkg_ids & accessible_ids:
            raise DatasetNotFoundError(dataset_id)
    fields_with_levels = await dataset_repo.get_fields_with_levels(session, dataset_id)
    fields_out = [
        FieldWithLevels.model_validate(
            {
                **f.model_dump(),
                "levels": [LevelOut.model_validate(lv.model_dump()) for lv in levels],
            }
        )
        for f, levels in fields_with_levels
    ]
    return DatasetWithFields.model_validate({**ds.model_dump(), "fields": fields_out})


async def delete_dataset(
    session: AsyncSession, dataset_id: int, accessible_ids: set[int] | None = None
) -> None:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    if accessible_ids is not None:
        pkg_ids = await package_repo.get_package_ids_for_dataset(session, dataset_id)
        if not pkg_ids & accessible_ids:
            raise DatasetNotFoundError(dataset_id)
    deleted = await dataset_repo.delete_dataset(session, dataset_id)
    if not deleted:
        raise DatasetNotFoundError(dataset_id)


async def get_csv_data(
    session: AsyncSession, dataset_id: int, accessible_ids: set[int] | None = None
) -> tuple[list[str], list[Response]]:
    """Raises DatasetNotFoundError if dataset_id does not exist.
    Returns (field_keys, rows) for CSV generation."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    if accessible_ids is not None:
        pkg_ids = await package_repo.get_package_ids_for_dataset(session, dataset_id)
        if not pkg_ids & accessible_ids:
            raise DatasetNotFoundError(dataset_id)
    _total, rows = await dataset_repo.get_responses(session, dataset_id, page=1, page_size=100_000)
    fields = await dataset_repo.get_fields_for_datasets(session, [dataset_id])
    return [f.field_key for f in fields], rows


async def get_responses(
    session: AsyncSession,
    dataset_id: int,
    page: int,
    page_size: int,
    accessible_ids: set[int] | None = None,
) -> ResponsePage:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    if accessible_ids is not None:
        pkg_ids = await package_repo.get_package_ids_for_dataset(session, dataset_id)
        if not pkg_ids & accessible_ids:
            raise DatasetNotFoundError(dataset_id)
    total, items = await dataset_repo.get_responses(session, dataset_id, page, page_size)
    return ResponsePage(
        total=total,
        page=page,
        page_size=page_size,
        items=[ResponseRead.model_validate(r.model_dump()) for r in items],
    )
