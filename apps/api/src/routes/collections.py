from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.database import get_session
from src.errors import CollectionNotFoundError
from src.models.collection import CollectionWithDatasets, InconsistencyOut
from src.services import collection_service

router = APIRouter(tags=["collections"])


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
def get_collection(collection_id: int, session: Session = Depends(get_session)):
    try:
        return collection_service.get_with_datasets(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None


@router.get(
    "/collections/{collection_id}/consistency",
    response_model=list[InconsistencyOut],
)
def get_collection_consistency(collection_id: int, session: Session = Depends(get_session)):
    try:
        issues = collection_service.get_consistency(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None
    return [
        InconsistencyOut(
            field_key=i.field_key,
            inconsistency_type=i.inconsistency_type.value,
            detail=i.detail,
        )
        for i in issues
    ]
