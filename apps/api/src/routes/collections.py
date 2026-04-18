import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.database import get_session
from src.errors import CollectionNotFoundError
from src.models.collection import CollectionRead, CollectionWithDatasets, InconsistencyOut
from src.repositories import collection_repo, package_repo
from src.services import collection_service

router = APIRouter(tags=["collections"])


class CollectionCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None
    collection_type: str = "generic"
    package_id: int


def _slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


@router.post("/collections", response_model=CollectionRead, status_code=201)
async def create_collection(body: CollectionCreate, session: AsyncSession = Depends(get_session)):
    """Create a new collection within a package."""
    pkg = await package_repo.get_by_id(session, body.package_id)
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    slug = body.slug or _slugify(body.name)
    return await collection_repo.create_collection(
        session,
        name=body.name,
        slug=slug,
        package_id=body.package_id,
        description=body.description,
        collection_type=body.collection_type,
    )


@router.get("/collections/{collection_id}", response_model=CollectionWithDatasets)
async def get_collection(collection_id: int, session: AsyncSession = Depends(get_session)):
    """Get a collection with all its datasets."""
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
    """List field inconsistencies across datasets in a collection (e.g. mismatched types or labels)."""
    try:
        return await collection_service.get_consistency(session, collection_id)
    except CollectionNotFoundError:
        raise HTTPException(status_code=404, detail="Collection not found") from None
