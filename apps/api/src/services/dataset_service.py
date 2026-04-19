from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import DatasetNotFoundError
from src.models.dataset import DatasetWithFields, FieldWithLevels, LevelOut
from src.models.response import Response, ResponsePage, ResponseRead
from src.repositories import dataset_repo


async def get_with_fields(session: AsyncSession, dataset_id: int) -> DatasetWithFields:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
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


async def delete_dataset(session: AsyncSession, dataset_id: int) -> None:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    deleted = await dataset_repo.delete_dataset(session, dataset_id)
    if not deleted:
        raise DatasetNotFoundError(dataset_id)


async def get_csv_data(session: AsyncSession, dataset_id: int) -> tuple[list[str], list[Response]]:
    """Raises DatasetNotFoundError if dataset_id does not exist.
    Returns (field_keys, rows) for CSV generation."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    _total, rows = await dataset_repo.get_responses(session, dataset_id, page=1, page_size=100_000)
    fields = await dataset_repo.get_fields_for_datasets(session, [dataset_id])
    return [f.field_key for f in fields], rows


async def get_responses(
    session: AsyncSession, dataset_id: int, page: int, page_size: int
) -> ResponsePage:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = await dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    total, items = await dataset_repo.get_responses(session, dataset_id, page, page_size)
    return ResponsePage(
        total=total,
        page=page,
        page_size=page_size,
        items=[ResponseRead.model_validate(r.model_dump()) for r in items],
    )
