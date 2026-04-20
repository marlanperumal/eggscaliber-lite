from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.collection import (
    CollectionCreate,
    CollectionRead,
    CollectionWithDatasets,
    InconsistencyOut,
)
from src.services import collection_service

router = APIRouter(tags=["collections"])


@router.post("/collections", response_model=CollectionRead, status_code=201)
async def create_collection(body: CollectionCreate, session: AsyncSession = Depends(get_session)):
    """Create a new collection within a package."""
    return await collection_service.create_collection(session, body)


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
async def get_collection(collection_id: int, session: AsyncSession = Depends(get_session)):
    """Get a collection with all its datasets."""
    return await collection_service.get_with_datasets(session, collection_id)


@router.get(
    "/collections/{collection_id}/consistency",
    response_model=list[InconsistencyOut],
)
async def get_collection_consistency(
    collection_id: int, session: AsyncSession = Depends(get_session)
):
    """List field inconsistencies across datasets in a collection (e.g. mismatched types or labels)."""
    return await collection_service.get_consistency(session, collection_id)
