from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.package import Package


def get_all(session: Session) -> list[Package]:
    return session.execute(select(Package)).scalars().all()


def get_by_id(session: Session, package_id: int) -> Package | None:
    return session.execute(select(Package).where(Package.id == package_id)).scalars().first()
