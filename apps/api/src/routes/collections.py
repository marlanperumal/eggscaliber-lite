from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import CollectionNotFoundError
from src.models.collection import CollectionWithDatasets, InconsistencyOut
from src.services import collection_service

router = APIRouter(tags=["collections"])


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
async def get_collection(collection_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await collection_service.get_with_datasets(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None


@router.get(
    "/collections/{collection_id}/consistency",
    response_model=list[InconsistencyOut],
)
async def get_collection_consistency(
    collection_id: int, session: AsyncSession = Depends(get_session)
):
    try:
        issues = await collection_service.get_consistency(session, collection_id)
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
