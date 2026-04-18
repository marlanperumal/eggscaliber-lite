from sqlalchemy import delete as sql_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.collection import Collection
from src.models.package import Package
from src.models.upload import (
    UploadField,
    UploadFieldGroup,
    UploadLevel,
    UploadSession,
    UploadSessionStatus,
)


async def get_collection_meta(session: AsyncSession, collection_id: int) -> dict | None:
    result = await session.get(Collection, collection_id)
    if result is None:
        return None
    pkg = await session.get(Package, result.package_id)
    package_name = pkg.name if pkg else None
    return {
        "collection_name": result.name,
        "package_name": package_name,
    }


async def get_session_by_id(session: AsyncSession, session_id: int) -> UploadSession | None:
    return (
        (await session.execute(select(UploadSession).where(UploadSession.id == session_id)))
        .scalars()
        .first()
    )


async def create_session(session: AsyncSession, **kwargs) -> UploadSession:
    obj = UploadSession(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def update_session_status(
    session: AsyncSession, session_id: int, status: UploadSessionStatus
) -> None:
    obj = await get_session_by_id(session, session_id)
    if obj:
        obj.status = status
        session.add(obj)
        await session.flush()


async def create_upload_field(session: AsyncSession, **kwargs) -> UploadField:
    obj = UploadField(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_fields_for_session(session: AsyncSession, session_id: int) -> list[UploadField]:
    return list(
        (
            await session.execute(
                select(UploadField)
                .where(UploadField.upload_session_id == session_id)
                .order_by(UploadField.sort_order, UploadField.id)
            )
        )
        .scalars()
        .all()
    )


async def get_field_by_id(session: AsyncSession, field_id: int) -> UploadField | None:
    return (
        (await session.execute(select(UploadField).where(UploadField.id == field_id)))
        .scalars()
        .first()
    )


async def create_upload_level(session: AsyncSession, **kwargs) -> UploadLevel:
    obj = UploadLevel(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_levels_for_field(session: AsyncSession, field_id: int) -> list[UploadLevel]:
    return list(
        (
            await session.execute(
                select(UploadLevel)
                .where(UploadLevel.upload_field_id == field_id)
                .order_by(UploadLevel.sort_order)
            )
        )
        .scalars()
        .all()
    )


async def upsert_level(
    session: AsyncSession,
    field_id: int,
    raw_value: str,
    display_label: str | None,
    sort_order: int,
    is_inherited: bool = False,
) -> UploadLevel:
    result = await session.execute(
        select(UploadLevel).where(
            UploadLevel.upload_field_id == field_id,
            UploadLevel.raw_value == raw_value,
        )
    )
    level = result.scalar_one_or_none()
    if level is None:
        level = UploadLevel(
            upload_field_id=field_id,
            raw_value=raw_value,
            display_label=display_label,
            sort_order=sort_order,
            is_inherited=is_inherited,
        )
        session.add(level)
    else:
        level.display_label = display_label
        level.sort_order = sort_order
        level.is_inherited = is_inherited
    await session.flush()
    await session.refresh(level)
    return level


async def delete_level(session: AsyncSession, field_id: int, level_id: int) -> bool:
    level = await session.get(UploadLevel, level_id)
    if level is None or level.upload_field_id != field_id:
        return False
    await session.delete(level)
    await session.flush()
    return True


async def delete_field(session: AsyncSession, upload_session_id: int, field_id: int) -> bool:
    field = await session.get(UploadField, field_id)
    if field is None or field.upload_session_id != upload_session_id:
        return False
    await session.execute(sql_delete(UploadLevel).where(UploadLevel.upload_field_id == field_id))
    await session.delete(field)
    await session.flush()
    return True


async def create_upload_fieldgroup(session: AsyncSession, **kwargs) -> UploadFieldGroup:
    obj = UploadFieldGroup(**kwargs)
    session.add(obj)
    await session.flush()
    await session.refresh(obj)
    return obj


async def get_fieldgroups_for_session(
    session: AsyncSession, session_id: int
) -> list[UploadFieldGroup]:
    return list(
        (
            await session.execute(
                select(UploadFieldGroup)
                .where(UploadFieldGroup.upload_session_id == session_id)
                .order_by(UploadFieldGroup.sort_order, UploadFieldGroup.id)
            )
        )
        .scalars()
        .all()
    )


async def list_draft_sessions(session: AsyncSession) -> list[UploadSession]:
    """Return all sessions that are not committed or abandoned."""
    result = await session.execute(
        select(UploadSession)
        .where(
            UploadSession.status.not_in(
                [UploadSessionStatus.committed, UploadSessionStatus.abandoned]
            )
        )
        .order_by(UploadSession.created_at.desc())
    )
    return list(result.scalars().all())


async def discard_session(session: AsyncSession, session_id: int) -> bool:
    """Set status to abandoned. Returns False if session not found."""
    sess = await get_session_by_id(session, session_id)
    if sess is None:
        return False
    sess.status = UploadSessionStatus.abandoned
    session.add(sess)
    await session.flush()
    return True
