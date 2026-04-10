from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlmodel import SQLModel

from src.database import get_session
from src.models.collection import CollectionType
from src.models.package import PackageRead
from src.repositories import package_repo

router = APIRouter(tags=["packages"])


class CollectionSummary(SQLModel):
    id: int
    name: str
    slug: str
    collection_type: CollectionType


class PackageWithCollections(PackageRead):
    collections: list[CollectionSummary] = []


@router.get("/packages", response_model=list[PackageRead])
def list_packages(session: Session = Depends(get_session)):
    return package_repo.get_all(session)


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
def get_package(package_id: int, session: Session = Depends(get_session)):
    pkg = package_repo.get_by_id(session, package_id)
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    collections = package_repo.get_collections_for_package(session, package_id)
    return PackageWithCollections(**pkg.model_dump(), collections=collections)
