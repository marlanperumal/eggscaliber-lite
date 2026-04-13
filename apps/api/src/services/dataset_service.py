from sqlalchemy.orm import Session

from src.errors import DatasetNotFoundError
from src.models.dataset import DatasetWithFields, FieldWithLevels
from src.models.response import ResponsePage
from src.repositories import dataset_repo


def get_with_fields(session: Session, dataset_id: int) -> DatasetWithFields:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    fields_with_levels = dataset_repo.get_fields_with_levels(session, dataset_id)
    fields_out = [
        FieldWithLevels(**f.model_dump(), levels=levels) for f, levels in fields_with_levels
    ]
    return DatasetWithFields(**ds.model_dump(), fields=fields_out)


def get_responses(session: Session, dataset_id: int, page: int, page_size: int) -> ResponsePage:
    """Raises DatasetNotFoundError if dataset_id does not exist."""
    ds = dataset_repo.get_by_id(session, dataset_id)
    if ds is None:
        raise DatasetNotFoundError(dataset_id)
    total, items = dataset_repo.get_responses(session, dataset_id, page, page_size)
    return ResponsePage(total=total, page=page, page_size=page_size, items=items)
