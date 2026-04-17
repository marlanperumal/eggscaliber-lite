from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.reconciliation import ReconciliationGroup, ReconciliationRow, ReconciliationStatus


async def create_row(session: AsyncSession, **kwargs) -> ReconciliationRow:
    obj = ReconciliationRow(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def bulk_create_rows(session: AsyncSession, rows: list[dict]) -> list[ReconciliationRow]:
    objs = [ReconciliationRow(**r) for r in rows]
    session.add_all(objs)
    await session.flush()
    return objs


async def get_rows_page(
    session: AsyncSession,
    upload_session_id: int,
    group: ReconciliationGroup | None = None,
    after_id: int | None = None,
    page_size: int = 50,
) -> list[ReconciliationRow]:
    stmt = select(ReconciliationRow).where(ReconciliationRow.upload_session_id == upload_session_id)
    if group is not None:
        stmt = stmt.where(ReconciliationRow.group == group)
    if after_id is not None:
        stmt = stmt.where(ReconciliationRow.id > after_id)
    stmt = stmt.order_by(ReconciliationRow.id).limit(page_size)
    return list((await session.execute(stmt)).scalars().all())


async def get_all_ids(
    session: AsyncSession,
    upload_session_id: int,
    group: ReconciliationGroup | None = None,
) -> list[int]:
    stmt = select(ReconciliationRow.id).where(
        ReconciliationRow.upload_session_id == upload_session_id
    )
    if group is not None:
        stmt = stmt.where(ReconciliationRow.group == group)
    return list((await session.execute(stmt)).scalars().all())


async def resolve_row(
    session: AsyncSession,
    row_id: int,
    status: ReconciliationStatus,
    ref_field_id: int | None = None,
) -> ReconciliationRow | None:
    row = (
        (await session.execute(select(ReconciliationRow).where(ReconciliationRow.id == row_id)))
        .scalars()
        .first()
    )
    if row:
        row.status = status
        if ref_field_id is not None:
            row.ref_field_id = ref_field_id
        session.add(row)
        await session.flush()
    return row


async def get_counts_by_group(
    session: AsyncSession,
    upload_session_id: int,
) -> dict[str, int]:
    rows = list(
        (
            await session.execute(
                select(ReconciliationRow.group, func.count().label("n"))
                .where(ReconciliationRow.upload_session_id == upload_session_id)
                .group_by(ReconciliationRow.group)
            )
        ).all()
    )
    base: dict[str, int] = {"exact": 0, "probable": 0, "new_only": 0, "old_only": 0}
    for group, count in rows:
        base[group.value if hasattr(group, "value") else group] = count
    return base


async def get_status_counts(
    session: AsyncSession,
    upload_session_id: int,
) -> dict[str, int]:
    result = await session.execute(
        select(ReconciliationRow.status, func.count(ReconciliationRow.id).label("cnt"))
        .where(ReconciliationRow.upload_session_id == upload_session_id)
        .group_by(ReconciliationRow.status)
    )
    return {row.status: row.cnt for row in result}


async def bulk_resolve(
    session: AsyncSession,
    upload_session_id: int,
    row_ids: list[int],
    status: ReconciliationStatus,
) -> int:
    rows = list(
        (
            await session.execute(
                select(ReconciliationRow).where(
                    ReconciliationRow.upload_session_id == upload_session_id,
                    ReconciliationRow.id.in_(row_ids),
                )
            )
        )
        .scalars()
        .all()
    )
    for row in rows:
        row.status = status
        session.add(row)
    await session.flush()
    return len(rows)
