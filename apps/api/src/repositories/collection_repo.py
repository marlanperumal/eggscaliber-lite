from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models.collection import Collection
from src.models.dataset import Dataset


def get_by_id(session: Session, collection_id: int) -> Collection | None:
    return (
        session.execute(select(Collection).where(Collection.id == collection_id)).scalars().first()
    )


def get_datasets_for_collection(session: Session, collection_id: int) -> list[Dataset]:
    return (
        session.execute(
            select(Dataset)
            .where(Dataset.collection_id == collection_id)
            .order_by(Dataset.sort_order)
        )
        .scalars()
        .all()
    )
