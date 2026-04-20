"""Orchestrates file save + field detection + upload_session creation."""

import asyncio
import csv
import io
import os
import tempfile
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.errors import (
    FieldGroupNotFoundError,
    FieldNotFoundError,
    InvalidFileTypeError,
    LevelNotFoundError,
    ReconciliationRowNotFoundError,
    UploadSessionNotFoundError,
)
from src.models.field import Field, FieldType
from src.models.level import Level as LiveLevel
from src.models.reconciliation import (
    BulkResolvedOut,
    ReconcileCountsOut,
    ReconcileRowOut,
    ReconcileRowPage,
    ReconcileRowResolvedOut,
    ReconcileTriggerOut,
    ReconciliationGroup,
    ReconciliationRowCreate,
    ReconciliationStatus,
)
from src.models.upload import (
    DeletedOut,
    FieldGroupDetail,
    FieldMoveOut,
    SuggestedReferenceOut,
    UploadCreatedResponse,
    UploadField,
    UploadFieldGroup,
    UploadFieldGroupOut,
    UploadFieldOut,
    UploadFieldOverrideOut,
    UploadFieldTreeFieldOut,
    UploadFieldTreeOut,
    UploadLevel,
    UploadLevelOut,
    UploadSessionDetail,
    UploadSessionListItem,
    UploadSessionListResponse,
    UploadSessionStatus,
)
from src.orm import pk
from src.repositories import dataset_repo, reconciliation_repo, upload_repo
from src.services import commit_service, reconciliation_service
from src.services.detection_service import detect_fields

_UPLOAD_DIR = os.environ.get("UPLOAD_DIR", tempfile.gettempdir())
_ALLOWED_TYPES = {"text/csv", "application/csv", "application/octet-stream"}
_MAX_SAMPLE = 200


async def create_upload_session(
    session: AsyncSession,
    *,
    filename: str,
    content: bytes,
    content_type: str,
    dataset_name: str,
    collection_id: int | None = None,
    collected_at: date | None = None,
) -> UploadCreatedResponse:
    """Save file, detect fields, persist staging records."""
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
    field_records: list[UploadFieldOut] = []
    for i, det in enumerate(detected):
        uf = await upload_repo.create_upload_field(
            session,
            upload_session_id=pk(sess),
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
                    upload_field_id=pk(uf),
                    raw_value=val,
                    display_label=val,
                    sort_order=j,
                )
        field_records.append(
            UploadFieldOut(
                id=pk(uf),
                field_key=uf.field_key,
                detected_type=uf.detected_type,
                override_type=None,
                sort_order=uf.sort_order,
                confidence=uf.confidence,
                value_sample=uf.value_sample or [],
            )
        )

    return UploadCreatedResponse(
        id=pk(sess),
        status=sess.status,
        dataset_name=sess.dataset_name,
        collection_id=sess.collection_id,
        row_count=sess.row_count,
        fields=field_records,
    )


async def get_upload_session(session: AsyncSession, session_id: int) -> UploadSessionDetail:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)
    field_list = [
        UploadFieldOut(
            id=pk(f),
            field_key=f.field_key,
            detected_type=f.detected_type,
            override_type=f.override_type,
            display_name=f.display_name,
            sort_order=f.sort_order,
            upload_fieldgroup_id=f.upload_fieldgroup_id,
            confidence=f.confidence,
            value_sample=f.value_sample or [],
        )
        for f in fields
    ]
    collection_meta: dict[str, str | None] = {}
    if sess.collection_id:
        collection_meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
    return UploadSessionDetail(
        id=pk(sess),
        status=sess.status,
        dataset_name=sess.dataset_name,
        collection_id=sess.collection_id,
        collection_name=collection_meta.get("collection_name"),
        package_name=collection_meta.get("package_name"),
        collected_at=sess.collected_at.isoformat() if sess.collected_at else None,
        file_name=os.path.basename(sess.file_path).split("_", 2)[-1],
        row_count=sess.row_count,
        fields=field_list,
    )


async def list_upload_sessions(session: AsyncSession) -> UploadSessionListResponse:
    """Returns all non-committed, non-abandoned upload sessions."""
    sessions = await upload_repo.list_draft_sessions(session)
    items: list[UploadSessionListItem] = []
    for sess in sessions:
        meta: dict[str, str | None] = {}
        if sess.collection_id:
            meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
        items.append(
            UploadSessionListItem(
                id=pk(sess),
                status=sess.status,
                dataset_name=sess.dataset_name,
                collection_name=meta.get("collection_name"),
                package_name=meta.get("package_name"),
                collected_at=sess.collected_at.isoformat() if sess.collected_at else None,
                created_at=sess.created_at.isoformat(),
            )
        )
    return UploadSessionListResponse(items=items)


async def discard_session(session: AsyncSession, session_id: int) -> None:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    discarded = await upload_repo.discard_session(session, session_id)
    if not discarded:
        raise UploadSessionNotFoundError(session_id)


async def get_suggested_reference(session: AsyncSession, session_id: int) -> SuggestedReferenceOut:
    """Raises UploadSessionNotFoundError if session_id does not exist."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    if sess.collection_id is None:
        return SuggestedReferenceOut(dataset_id=None, dataset_name=None)
    ds = await dataset_repo.get_latest_for_collection(session, sess.collection_id)
    if ds is None:
        return SuggestedReferenceOut(dataset_id=None, dataset_name=None)
    return SuggestedReferenceOut(dataset_id=pk(ds), dataset_name=ds.name)


async def commit(session: AsyncSession, session_id: int) -> int:
    """Raises UploadSessionNotFoundError if session_id does not exist.
    Returns the new dataset_id."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    return await commit_service.commit_upload(session, session_id)


async def override_field(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    override_type: FieldType | None,
    display_name: str | None,
    upload_fieldgroup_id: int | None,
    sort_order: int | None,
    fieldgroup_id_set: bool,
) -> UploadFieldOverrideOut:
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
    # Exception: f is already tracked by the session; session.add() + flush() is the standard
    # SQLAlchemy in-place update idiom. A repo save_field() wrapper would be empty boilerplate.
    session.add(f)
    await session.flush()
    return UploadFieldOverrideOut(
        id=pk(f),
        field_key=f.field_key,
        detected_type=f.detected_type,
        override_type=f.override_type,
        display_name=f.display_name,
        sort_order=f.sort_order,
        upload_fieldgroup_id=f.upload_fieldgroup_id,
    )


async def delete_field(session: AsyncSession, session_id: int, field_id: int) -> None:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    deleted = await upload_repo.delete_field(session, session_id, field_id)
    if not deleted:
        raise FieldNotFoundError(field_id)


async def move_field(
    session: AsyncSession, session_id: int, field_id: int, group_id: int | None
) -> FieldMoveOut:
    """Raises FieldNotFoundError if field not found or doesn't belong to session."""
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise FieldNotFoundError(field_id)
    f.upload_fieldgroup_id = group_id
    # Exception: same in-place update idiom — tracked object, no query, no business logic.
    session.add(f)
    await session.flush()
    return FieldMoveOut(id=pk(f), upload_fieldgroup_id=f.upload_fieldgroup_id)


async def upsert_level(
    session: AsyncSession,
    session_id: int,
    field_id: int,
    *,
    raw_value: str,
    display_label: str | None,
    sort_order: int,
    is_inherited: bool,
) -> UploadLevel:
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


async def get_field_tree(session: AsyncSession, session_id: int) -> UploadFieldTreeOut:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    groups = await upload_repo.get_fieldgroups_for_session(session, session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)

    def _group_out(g: UploadFieldGroup) -> UploadFieldGroupOut:
        field_count = sum(1 for f in fields if f.upload_fieldgroup_id == g.id)
        return UploadFieldGroupOut(
            id=pk(g),
            name=g.name,
            parent_id=g.parent_id,
            sort_order=g.sort_order,
            field_count=field_count,
        )

    async def _field_out(f: UploadField) -> UploadFieldTreeFieldOut:
        levels = await upload_repo.get_levels_for_field(session, pk(f))
        return UploadFieldTreeFieldOut(
            id=pk(f),
            field_key=f.field_key,
            display_name=f.display_name,
            detected_type=f.detected_type,
            override_type=f.override_type,
            sort_order=f.sort_order,
            upload_fieldgroup_id=f.upload_fieldgroup_id,
            levels=[
                UploadLevelOut(
                    id=pk(lvl),
                    raw_value=lvl.raw_value,
                    display_label=lvl.display_label,
                    sort_order=lvl.sort_order,
                    is_inherited=lvl.is_inherited,
                )
                for lvl in levels
            ],
        )

    field_outs = await asyncio.gather(*[_field_out(f) for f in fields])
    return UploadFieldTreeOut(
        groups=[_group_out(g) for g in groups],
        fields=[d for d in field_outs if d.upload_fieldgroup_id is not None],
        unassigned_fields=[d for d in field_outs if d.upload_fieldgroup_id is None],
    )


async def create_fieldgroup(
    session: AsyncSession, session_id: int, *, name: str, parent_id: int | None, sort_order: int
) -> FieldGroupDetail:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    grp = await upload_repo.create_upload_fieldgroup(
        session, upload_session_id=session_id, name=name, parent_id=parent_id, sort_order=sort_order
    )
    return FieldGroupDetail(
        id=pk(grp),
        name=grp.name,
        parent_id=grp.parent_id,
        sort_order=grp.sort_order,
    )


async def update_fieldgroup(
    session: AsyncSession,
    session_id: int,
    group_id: int,
    *,
    name: str | None,
    parent_id: int | None,
    parent_id_set: bool,
    sort_order: int | None,
) -> FieldGroupDetail:
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
    # Exception: same in-place update idiom — tracked object, no query, no business logic.
    session.add(grp)
    await session.flush()
    return FieldGroupDetail(
        id=pk(grp),
        name=grp.name,
        parent_id=grp.parent_id,
        sort_order=grp.sort_order,
    )


async def delete_fieldgroup_svc(
    session: AsyncSession, session_id: int, group_id: int
) -> DeletedOut:
    """Raises FieldGroupNotFoundError if group not found in this session."""
    grp = await upload_repo.get_fieldgroup_by_id_and_session(session, group_id, session_id)
    if grp is None:
        raise FieldGroupNotFoundError(group_id)
    await upload_repo.delete_fieldgroup(session, grp)
    return DeletedOut(deleted=group_id)


async def trigger_reconcile(
    session: AsyncSession, session_id: int, reference_dataset_id: int
) -> ReconcileTriggerOut:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)

    new_fields = await upload_repo.get_fields_for_session(session, session_id)
    new_levels_by_field: dict[int, list] = {}
    for f in new_fields:
        new_levels_by_field[pk(f)] = await upload_repo.get_levels_for_field(session, pk(f))

    ref_fields_raw = await dataset_repo.get_fields_with_levels(session, reference_dataset_id)
    ref_by_key = {f.field_key: (f, lvls) for f, lvls in ref_fields_raw}

    rows_to_create: list[ReconciliationRowCreate] = []
    matched_ref_keys: set[str] = set()

    for uf in new_fields:
        stub = Field(
            field_key=uf.field_key,
            display_name=uf.field_key,
            field_type=uf.override_type or uf.detected_type,
            dataset_id=0,
        )
        best_ref = None
        best_ref_lvls: list = []
        if uf.field_key in ref_by_key:
            best_ref, best_ref_lvls = ref_by_key[uf.field_key]
        else:
            for key, (rf, rl) in ref_by_key.items():
                d = reconciliation_service.edit_distance(uf.field_key, key)
                if d < 4:
                    best_ref, best_ref_lvls = rf, rl
                    break

        upload_lvls = new_levels_by_field.get(pk(uf), [])
        stub_lvls = [
            LiveLevel(
                value=ul.raw_value,
                display_label=ul.raw_value,
                sort_order=ul.sort_order,
                field_id=0,
            )
            for ul in upload_lvls
        ]
        result = reconciliation_service.classify_row(stub, stub_lvls, best_ref, best_ref_lvls)
        if best_ref:
            matched_ref_keys.add(best_ref.field_key)
        rows_to_create.append(
            ReconciliationRowCreate(
                upload_session_id=session_id,
                upload_field_id=pk(uf),
                ref_field_id=pk(best_ref) if best_ref and best_ref.id else None,
                group=result.group,
                status=result.status,
                confidence=result.confidence,
                note=result.note,
            )
        )

    for key, (rf, _) in ref_by_key.items():
        if key not in matched_ref_keys:
            rows_to_create.append(
                ReconciliationRowCreate(
                    upload_session_id=session_id,
                    upload_field_id=None,
                    ref_field_id=pk(rf) if rf.id else None,
                    group=ReconciliationGroup.old_only,
                    status=ReconciliationStatus.pending,
                    confidence=None,
                    note="Present in reference, absent in new file",
                )
            )

    await reconciliation_repo.bulk_create_rows(session, rows_to_create)
    sess.reference_dataset_id = reference_dataset_id
    # Exception: same in-place update idiom — tracked object, persisted alongside bulk_create_rows.
    session.add(sess)
    await session.flush()
    return ReconcileTriggerOut(total=len(rows_to_create))


async def list_reconcile_rows(
    session: AsyncSession,
    session_id: int,
    group: ReconciliationGroup | None,
    after_id: int | None,
    page_size: int,
) -> ReconcileRowPage:
    rows = await reconciliation_repo.get_rows_page(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )
    next_cursor = rows[-1].id if len(rows) == page_size else None

    upload_field_ids = [r.upload_field_id for r in rows if r.upload_field_id]
    ref_field_ids = [r.ref_field_id for r in rows if r.ref_field_id]
    uf_map = {
        pk(u): u
        for u in await upload_repo.get_upload_fields_by_ids(session, upload_field_ids)
        if u.id
    }
    rf_map = {
        pk(f): f for f in await dataset_repo.get_fields_by_ids(session, ref_field_ids) if f.id
    }

    return ReconcileRowPage(
        items=[
            ReconcileRowOut(
                id=pk(r),
                group=r.group,
                status=r.status,
                upload_field_id=r.upload_field_id,
                ref_field_id=r.ref_field_id,
                field_key=uf_map[r.upload_field_id].field_key
                if r.upload_field_id and r.upload_field_id in uf_map
                else None,
                field_type=(
                    uf_map[r.upload_field_id].override_type
                    or uf_map[r.upload_field_id].detected_type
                )
                if r.upload_field_id and r.upload_field_id in uf_map
                else None,
                ref_field_key=rf_map[r.ref_field_id].field_key
                if r.ref_field_id and r.ref_field_id in rf_map
                else None,
                confidence=r.confidence,
                note=r.note,
            )
            for r in rows
        ],
        next_cursor=next_cursor,
    )


async def get_reconcile_counts(session: AsyncSession, session_id: int) -> ReconcileCountsOut:
    """Raises UploadSessionNotFoundError if session not found."""
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise UploadSessionNotFoundError(session_id)
    group_counts = await reconciliation_repo.get_counts_by_group(session, session_id)
    status_counts = await reconciliation_repo.get_status_counts(session, session_id)
    blocking_pending = await reconciliation_repo.get_blocking_pending_count(session, session_id)
    return ReconcileCountsOut(
        exact=group_counts.get("exact", 0),
        probable=group_counts.get("probable", 0),
        new_only=group_counts.get("new_only", 0),
        old_only=group_counts.get("old_only", 0),
        status_counts=status_counts,
        blocking_pending=blocking_pending,
    )


async def resolve_reconcile_row(
    session: AsyncSession,
    session_id: int,
    row_id: int,
    status: ReconciliationStatus,
    ref_field_id: int | None,
    upload_field_id: int | None,
) -> ReconcileRowResolvedOut:
    """Raises ReconciliationRowNotFoundError if row not found."""
    row = await reconciliation_repo.resolve_row(
        session, row_id, status, ref_field_id=ref_field_id, upload_field_id=upload_field_id
    )
    if row is None:
        raise ReconciliationRowNotFoundError(row_id)
    return ReconcileRowResolvedOut(
        id=pk(row),
        status=row.status,
        upload_field_id=row.upload_field_id,
        ref_field_id=row.ref_field_id,
    )


async def bulk_resolve_rows(
    session: AsyncSession, session_id: int, ids: list[int], action: ReconciliationStatus
) -> BulkResolvedOut:
    resolved = await reconciliation_repo.bulk_resolve(session, session_id, ids, action)
    return BulkResolvedOut(resolved=resolved)
