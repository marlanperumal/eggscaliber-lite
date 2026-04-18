"""Orchestrates file save + field detection + upload_session creation."""

import asyncio
import csv
import io
import os
import tempfile
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import (
    FieldGroupNotFoundError,
    FieldNotFoundError,
    LevelNotFoundError,
    UploadSessionNotFoundError,
)
from src.models.field import FieldType
from src.models.upload import UploadSessionStatus
from src.repositories import dataset_repo, upload_repo
from src.services.detection_service import detect_fields

_UPLOAD_DIR = os.environ.get("UPLOAD_DIR", tempfile.gettempdir())
_ALLOWED_TYPES = {"text/csv", "application/csv", "application/octet-stream"}
_MAX_SAMPLE = 200


class InvalidFileTypeError(Exception): ...


async def create_upload_session(
    session: AsyncSession,
    *,
    filename: str,
    content: bytes,
    content_type: str,
    dataset_name: str,
    collection_id: int | None = None,
    collected_at: date | None = None,
) -> dict:
    """Save file, detect fields, persist staging records. Returns dict for response."""
    if not filename.lower().endswith(".csv"):
        raise InvalidFileTypeError(filename)

    # Save to disk
    os.makedirs(_UPLOAD_DIR, exist_ok=True)
    tmp_path = os.path.join(_UPLOAD_DIR, f"upload_{os.getpid()}_{filename}")
    with open(tmp_path, "wb") as fh:
        fh.write(content)

    # Parse CSV
    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    rows = []
    row_count = 0
    for row in reader:
        row_count += 1
        if len(rows) < _MAX_SAMPLE:
            rows.append(dict(row))

    # Run detection
    detected = detect_fields(list(headers), rows)

    # Persist session
    sess = await upload_repo.create_session(
        session,
        file_path=tmp_path,
        dataset_name=dataset_name,
        collection_id=collection_id,
        collected_at=collected_at,
        row_count=row_count,
        status=UploadSessionStatus.detecting,
    )

    # Persist fields + levels
    field_records = []
    for i, det in enumerate(detected):
        uf = await upload_repo.create_upload_field(
            session,
            upload_session_id=sess.id,
            field_key=det.field_key,
            detected_type=det.detected_type,
            sort_order=i,
            confidence=det.confidence,
            value_sample=det.distinct_values[:5] if det.distinct_values else None,
        )
        # Store distinct values as levels for ordinal/categorical
        if det.detected_type in (FieldType.ordinal, FieldType.categorical):
            for j, val in enumerate(det.distinct_values[:100]):
                await upload_repo.create_upload_level(
                    session,
                    upload_field_id=uf.id,
                    raw_value=val,
                    display_label=val,
                    sort_order=j,
                )
        field_records.append(
            {
                "id": uf.id,
                "field_key": uf.field_key,
                "detected_type": uf.detected_type.value,
                "override_type": None,
                "sort_order": uf.sort_order,
                "confidence": uf.confidence,
                "value_sample": uf.value_sample or [],
            }
        )

    return {
        "id": sess.id,
        "status": sess.status.value,
        "dataset_name": sess.dataset_name,
        "collection_id": sess.collection_id,
        "row_count": sess.row_count,
        "fields": field_records,
    }


async def get_upload_session(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)
    field_list = [
        {
            "id": f.id,
            "field_key": f.field_key,
            "detected_type": f.detected_type.value,
            "override_type": f.override_type.value if f.override_type else None,
            "sort_order": f.sort_order,
            "upload_fieldgroup_id": f.upload_fieldgroup_id,
            "confidence": f.confidence,
            "value_sample": f.value_sample or [],
        }
        for f in fields
    ]
    collection_meta: dict = {}
    if sess.collection_id:
        collection_meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
    return {
        "id": sess.id,
        "status": sess.status.value,
        "dataset_name": sess.dataset_name,
        "collection_id": sess.collection_id,
        "collection_name": collection_meta.get("collection_name"),
        "package_name": collection_meta.get("package_name"),
        "collected_at": sess.collected_at.isoformat() if sess.collected_at else None,
        "file_name": os.path.basename(sess.file_path).split("_", 2)[-1],
        "row_count": sess.row_count,
        "fields": field_list,
    }


async def discard_session(session: AsyncSession, session_id: int) -> None:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    discarded = await upload_repo.discard_session(session, session_id)
    if not discarded:
        raise UploadSessionNotFoundError(session_id)


async def get_suggested_reference(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    if sess.collection_id is None:
        return {"dataset_id": None, "dataset_name": None}
    ds = await dataset_repo.get_latest_for_collection(session, sess.collection_id)
    if ds is None:
        return {"dataset_id": None, "dataset_name": None}
    return {"dataset_id": ds.id, "dataset_name": ds.name}


async def commit(session: AsyncSession, session_id: int) -> int:
    """Raises UploadSessionNotFoundError if session_id does not exist.
    Returns the new dataset_id."""
    from src.services import commit_service

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    return await commit_service.commit_upload(session, session_id)


async def override_field(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    override_type: Any | None,
    display_name: str | None,
    upload_fieldgroup_id: Any,
    sort_order: int | None,
    fieldgroup_id_set: bool,
) -> dict:
    """Raises UploadSessionNotFoundError / FieldNotFoundError as appropriate."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    if override_type is not None:
        f.override_type = override_type
    if display_name is not None:
        f.display_name = display_name
    if fieldgroup_id_set:
        f.upload_fieldgroup_id = upload_fieldgroup_id
    if sort_order is not None:
        f.sort_order = sort_order
    session.add(f)
    await session.flush()
    return {
        "id": f.id,
        "field_key": f.field_key,
        "detected_type": f.detected_type.value,
        "override_type": f.override_type.value if f.override_type else None,
        "display_name": f.display_name,
        "sort_order": f.sort_order,
        "upload_fieldgroup_id": f.upload_fieldgroup_id,
    }


async def delete_field(session: AsyncSession, session_id: int, field_id: int) -> None:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    deleted = await upload_repo.delete_field(session, session_id, field_id)
    if not deleted:
        raise FieldNotFoundError(field_id)


async def move_field(
    session: AsyncSession, session_id: int, field_id: int, group_id: int | None
) -> dict:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    f.upload_fieldgroup_id = group_id
    session.add(f)
    await session.flush()
    return {"id": f.id, "upload_fieldgroup_id": f.upload_fieldgroup_id}


async def upsert_level(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    raw_value: str,
    display_label: str | None,
    sort_order: int,
    is_inherited: bool,
):
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    return await upload_repo.upsert_level(
        session,
        field_id=field_id,
        raw_value=raw_value,
        display_label=display_label,
        sort_order=sort_order,
        is_inherited=is_inherited,
    )


async def delete_level(
    session: AsyncSession, session_id: int, field_id: int, level_id: int
) -> None:
    """Raises FieldNotFoundError or LevelNotFoundError as appropriate."""
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    deleted = await upload_repo.delete_level(session, field_id, level_id)
    if not deleted:
        raise LevelNotFoundError(level_id)


async def get_field_tree(session: AsyncSession, session_id: int) -> dict:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    groups = await upload_repo.get_fieldgroups_for_session(session, session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)

    def _group_dict(g) -> dict:
        field_count = sum(1 for f in fields if f.upload_fieldgroup_id == g.id)
        return {
            "id": g.id,
            "name": g.name,
            "parent_id": g.parent_id,
            "sort_order": g.sort_order,
            "field_count": field_count,
        }

    async def _field_to_dict(f) -> dict:
        levels = await upload_repo.get_levels_for_field(session, f.id)
        return {
            "id": f.id,
            "field_key": f.field_key,
            "display_name": f.display_name,
            "detected_type": f.detected_type.value,
            "override_type": f.override_type.value if f.override_type else None,
            "sort_order": f.sort_order,
            "upload_fieldgroup_id": f.upload_fieldgroup_id,
            "levels": [
                {
                    "id": lvl.id,
                    "raw_value": lvl.raw_value,
                    "display_label": lvl.display_label,
                    "sort_order": lvl.sort_order,
                    "is_inherited": lvl.is_inherited,
                }
                for lvl in levels
            ],
        }

    field_dicts = await asyncio.gather(*[_field_to_dict(f) for f in fields])
    return {
        "groups": [_group_dict(g) for g in groups],
        "fields": [d for d in field_dicts if d["upload_fieldgroup_id"] is not None],
        "unassigned_fields": [d for d in field_dicts if d["upload_fieldgroup_id"] is None],
    }


async def create_fieldgroup(
    session: AsyncSession, session_id: int, *, name: str, parent_id: int | None, sort_order: int
) -> dict:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    grp = await upload_repo.create_upload_fieldgroup(
        session, upload_session_id=session_id, name=name, parent_id=parent_id, sort_order=sort_order
    )
    return {
        "id": grp.id,
        "name": grp.name,
        "parent_id": grp.parent_id,
        "sort_order": grp.sort_order,
    }


async def update_fieldgroup(
    session: AsyncSession,
    session_id: int,
    group_id: int,
    *,
    name: str | None,
    parent_id: int | None,
    parent_id_set: bool,
    sort_order: int | None,
) -> dict:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    grp = await upload_repo.get_fieldgroup_by_id_and_session(session, group_id, session_id)
    if grp is None:
        raise FieldGroupNotFoundError(group_id)
    if name is not None:
        grp.name = name
    if parent_id_set:
        grp.parent_id = parent_id
    if sort_order is not None:
        grp.sort_order = sort_order
    session.add(grp)
    await session.flush()
    return {"id": grp.id, "name": grp.name, "parent_id": grp.parent_id}


async def delete_fieldgroup_svc(session: AsyncSession, session_id: int, group_id: int) -> dict:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    grp = await upload_repo.get_fieldgroup_by_id_and_session(session, group_id, session_id)
    if grp is None:
        raise FieldGroupNotFoundError(group_id)
    await upload_repo.delete_fieldgroup(session, grp)
    return {"deleted": group_id}
