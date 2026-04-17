"""Atomically promotes staging records to live tables."""

import csv
import io
import re

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.dataset import Dataset
from src.models.field import Field
from src.models.field_group import FieldGroup
from src.models.level import Level
from src.models.response import Response
from src.models.upload import UploadSessionStatus
from src.repositories import upload_repo
from src.services.detection_service import slugify_key


def _slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unnamed"


async def commit_upload(session: AsyncSession, upload_session_id: int) -> int:
    """Promotes staging → live. Returns new dataset.id."""
    sess = await upload_repo.get_session_by_id(session, upload_session_id)
    if sess is None:
        raise ValueError(f"Upload session {upload_session_id} not found")

    # 1. Create Dataset
    name = sess.dataset_name or "Untitled"
    ds = Dataset(
        name=name,
        slug=_slugify(name),
        collection_id=sess.collection_id,
        collected_at=sess.collected_at,
    )
    session.add(ds)
    await session.flush()
    await session.refresh(ds)

    # 2. Promote field groups (staging → live), respecting parent hierarchy
    staging_groups = await upload_repo.get_fieldgroups_for_session(session, upload_session_id)
    # Sort: roots first, then children (parent_id is None for roots)
    roots = [g for g in staging_groups if g.parent_id is None]
    children = [g for g in staging_groups if g.parent_id is not None]

    staging_to_live_group: dict[int, int] = {}  # staging_group.id → live group.id

    for sg in roots:
        lg = FieldGroup(
            name=sg.name,
            slug=_slugify(sg.name),
            sort_order=sg.sort_order,
            dataset_id=ds.id,
            parent_id=None,
        )
        session.add(lg)
        await session.flush()
        await session.refresh(lg)
        staging_to_live_group[sg.id] = lg.id

    for sg in children:
        live_parent_id = staging_to_live_group.get(sg.parent_id)
        lg = FieldGroup(
            name=sg.name,
            slug=_slugify(sg.name),
            sort_order=sg.sort_order,
            dataset_id=ds.id,
            parent_id=live_parent_id,
        )
        session.add(lg)
        await session.flush()
        await session.refresh(lg)
        staging_to_live_group[sg.id] = lg.id

    # 3. Promote fields
    staging_fields = await upload_repo.get_fields_for_session(session, upload_session_id)
    staging_to_live_field: dict[int, int] = {}

    for sf in staging_fields:
        live_group_id = (
            staging_to_live_group.get(sf.upload_fieldgroup_id) if sf.upload_fieldgroup_id else None
        )
        lf = Field(
            field_key=sf.field_key,
            display_name=sf.display_name or sf.field_key,
            field_type=sf.override_type or sf.detected_type,
            sort_order=sf.sort_order,
            dataset_id=ds.id,
            group_id=live_group_id,
        )
        session.add(lf)
        await session.flush()
        await session.refresh(lf)
        staging_to_live_field[sf.id] = lf.id

        # 4. Promote levels
        staging_levels = await upload_repo.get_levels_for_field(session, sf.id)
        for sl in staging_levels:
            session.add(
                Level(
                    value=sl.raw_value,
                    display_label=sl.display_label or sl.raw_value,
                    sort_order=sl.sort_order,
                    field_id=lf.id,
                )
            )
        await session.flush()

    # 5. Stream CSV rows → Response records
    with open(sess.file_path, "rb") as fh:
        text = fh.read().decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        # Build payload keyed by field_key (slugified header)
        payload = {}
        for original_key, val in row.items():
            slug = slugify_key(original_key)
            payload[slug] = val
        session.add(Response(dataset_id=ds.id, payload=payload))
    await session.flush()

    # 6. Mark session committed
    sess.status = UploadSessionStatus.committed
    sess.committed_dataset_id = ds.id
    session.add(sess)
    await session.flush()

    return ds.id
