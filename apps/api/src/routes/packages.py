from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.database import get_session
from src.errors import PackageNotFoundError
from src.models.package import PackageRead, PackageWithCollections
from src.repositories import package_repo
from src.services import package_service

router = APIRouter(tags=["packages"])


@router.get("/packages", response_model=list[PackageRead])
def list_packages(session: Session = Depends(get_session)):
    return package_repo.get_all(session)


@router.get("/packages/{package_id}", response_model=PackageWithCollections)
def get_package(package_id: int, session: Session = Depends(get_session)):
    try:
        return package_service.get_with_collections(session, package_id)
    except PackageNotFoundError:
        raise HTTPException(status_code=404, detail="Package not found") from None
