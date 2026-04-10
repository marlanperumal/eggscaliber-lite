from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.models.collection import CollectionRead
from src.models.dataset import WorkerType
from src.repositories import collection_repo
from src.services.collection_service import check_field_consistency

router = APIRouter(tags=["collections"])


class DatasetSummary(SQLModel):
    id: int
    name: str
    slug: str
    sort_order: int
    worker_type: WorkerType


class CollectionWithDatasets(CollectionRead):
    datasets: list[DatasetSummary] = []


class InconsistencyOut(SQLModel):
    field_key: str
    inconsistency_type: str
    detail: str


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
def get_collection(collection_id: int, session: Session = Depends(get_session)):
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    datasets = collection_repo.get_datasets_for_collection(session, collection_id)
    return CollectionWithDatasets(**col.model_dump(), datasets=datasets)


@router.get(
    "/collections/{collection_id}/consistency",
    response_model=list[InconsistencyOut],
)
def get_collection_consistency(collection_id: int, session: Session = Depends(get_session)):
    col = collection_repo.get_by_id(session, collection_id)
    if col is None:
        raise HTTPException(status_code=404, detail="Collection not found")
    issues = check_field_consistency(collection_id, session)
    return [
        InconsistencyOut(
            field_key=i.field_key,
            inconsistency_type=i.inconsistency_type.value,
            detail=i.detail,
        )
        for i in issues
    ]
