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


async def delete_field(session: AsyncSession, upload_session_id: int, field_id: int) -> bool:
    from sqlalchemy import delete as sql_delete

    field = await session.get(UploadField, field_id)
    if field is None or field.upload_session_id != upload_session_id:
        return False
    await session.execute(sql_delete(UploadLevel).where(UploadLevel.upload_field_id == field_id))
    await session.delete(field)
    await session.commit()
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
