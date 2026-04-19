from typing import Protocol


class _HasIntId(Protocol):
    id: int | None


def pk(obj: _HasIntId) -> int:
    """Return the primary key of a DB-fetched ORM row.

    All SQLModel table classes declare `id: int | None` so SQLAlchemy can
    assign it on INSERT, but after any SELECT or flush the value is always
    non-None.  Using pk() instead of cast(int, obj.id) gives the same type
    narrowing *and* a runtime guard that catches misuse.
    """
    if obj.id is None:
        raise ValueError(
            f"{type(obj).__name__} has no primary key — "
            "was the row flushed/committed before pk() was called?"
        )
    return obj.id
