from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.auth import CurrentUser, get_accessible_package_ids, get_current_user
from src.database import get_session
from src.models.package import PackageRead, PackageWithCollections
from src.services import package_service

router = APIRouter(tags=["packages"])


class PackageCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None


@router.post("/packages", response_model=PackageRead, status_code=201)
async def create_package(
    body: PackageCreate,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Create a new package."""
    return await package_service.create_package(
        session, name=body.name, slug=body.slug, description=body.description
    )


@router.get("/packages", response_model=list[PackageRead])
async def list_packages(
    _: CurrentUser = Depends(get_current_user),
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """List all packages (top-level groupings of survey collections)."""
    return await package_service.list_packages(session, accessible_ids)


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
async def get_package(
    package_id: int,
    accessible_ids: set[int] | None = Depends(get_accessible_package_ids),
    session: AsyncSession = Depends(get_session),
):
    """Get a package with its collections."""
    return await package_service.get_with_collections(session, package_id, accessible_ids)
