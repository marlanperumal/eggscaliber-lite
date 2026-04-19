from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import SQLModel

from src.database import get_session
from src.errors import PackageNotFoundError
from src.models.package import PackageRead, PackageWithCollections
from src.repositories import package_repo
from src.services import package_service

router = APIRouter(tags=["packages"])


class PackageCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None


@router.post("/packages", response_model=PackageRead, status_code=201)
async def create_package(body: PackageCreate, session: AsyncSession = Depends(get_session)):
    """Create a new package."""
    return await package_service.create_package(
        session, name=body.name, slug=body.slug, description=body.description
    )


@router.get("/packages", response_model=list[PackageRead])
async def list_packages(session: AsyncSession = Depends(get_session)):
    """List all packages (top-level groupings of survey collections)."""
    return await package_repo.get_all(session)


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
async def get_package(package_id: int, session: AsyncSession = Depends(get_session)):
    """Get a package with its collections."""
    try:
        return await package_service.get_with_collections(session, package_id)
    except PackageNotFoundError:
        raise HTTPException(status_code=404, detail="Package not found") from None
