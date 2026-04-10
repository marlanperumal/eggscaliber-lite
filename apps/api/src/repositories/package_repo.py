from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.collection import Collection
from src.models.package import Package


def get_all(session: Session) -> list[Package]:
    return session.execute(select(Package)).scalars().all()


def get_by_id(session: Session, package_id: int) -> Package | None:
    return session.execute(select(Package).where(Package.id == package_id)).scalars().first()


def get_collections_for_package(session: Session, package_id: int) -> list[Collection]:
    return (
        session.execute(select(Collection).where(Collection.package_id == package_id))
        .scalars()
        .all()
    )
