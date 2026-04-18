import asyncio
import os
from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.field import Field, FieldType
from src.models.level import Level as LiveLevel
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus
from src.repositories import dataset_repo, reconciliation_repo, upload_repo
from src.services import commit_service, reconciliation_service, upload_service
from src.services.upload_service import InvalidFileTypeError

router = APIRouter(tags=["uploads"])


@router.post("/uploads", status_code=201)
async def create_upload(
    file: UploadFile,
    dataset_name: str = Form(),
    collection_id: int | None = Form(default=None),
    collected_at: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
):
    content = await file.read()
    collected_at_date: date | None = date.fromisoformat(collected_at) if collected_at else None
    try:
        result = await upload_service.create_upload_session(
            session,
            filename=file.filename or "upload.csv",
            content=content,
            content_type=file.content_type or "",
            dataset_name=dataset_name,
            collection_id=collection_id,
            collected_at=collected_at_date,
        )
    except InvalidFileTypeError:
        raise HTTPException(status_code=422, detail="Only CSV files are accepted") from None
    return result


@router.get("/uploads")
async def list_upload_sessions(session: AsyncSession = Depends(get_session)):
    """List all non-committed, non-abandoned upload sessions (drafts)."""
    sessions = await upload_repo.list_draft_sessions(session)
    items = []
    for sess in sessions:
        meta: dict = {}
        if sess.collection_id:
            meta = await upload_repo.get_collection_meta(session, sess.collection_id) or {}
        items.append(
            {
                "id": sess.id,
                "status": sess.status.value,
                "dataset_name": sess.dataset_name,
                "collection_name": meta.get("collection_name"),
                "package_name": meta.get("package_name"),
                "collected_at": sess.collected_at.isoformat() if sess.collected_at else None,
                "created_at": sess.created_at.isoformat(),
            }
        )
    return {"items": items}


@router.delete("/uploads/{session_id}", status_code=204)
async def discard_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    """Mark an upload session as abandoned (soft delete)."""
    discarded = await upload_repo.discard_session(session, session_id)
    if not discarded:
        raise HTTPException(status_code=404, detail="Upload session not found")


@router.get("/uploads/{session_id}")
async def get_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
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
        # strip the upload_{pid}_ prefix added by upload_service
        "file_name": os.path.basename(sess.file_path).split("_", 2)[-1],
        "row_count": sess.row_count,
        "fields": field_list,
    }


class FieldOverride(BaseModel):
    override_type: FieldType | None = None
    display_name: str | None = None
    upload_fieldgroup_id: int | None = None
    sort_order: int | None = None


@router.patch("/uploads/{session_id}/fields/{field_id}")
async def override_field(
    session_id: int,
    field_id: int,
    body: FieldOverride,
    session: AsyncSession = Depends(get_session),
):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise HTTPException(status_code=404, detail="Field not found")
    if body.override_type is not None:
        f.override_type = body.override_type
    if body.display_name is not None:
        f.display_name = body.display_name
    if body.upload_fieldgroup_id is not None:
        f.upload_fieldgroup_id = body.upload_fieldgroup_id
    if body.sort_order is not None:
        f.sort_order = body.sort_order
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


@router.delete("/uploads/{upload_session_id}/fields/{field_id}", status_code=204)
async def delete_field(
    upload_session_id: int,
    field_id: int,
    session: AsyncSession = Depends(get_session),
):
    deleted = await upload_repo.delete_field(session, upload_session_id, field_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Field not found")


class ReconcileTrigger(BaseModel):
    reference_dataset_id: int


class BulkResolve(BaseModel):
    ids: list[int]
    action: ReconciliationStatus  # confirmed | rejected | excluded


@router.post("/uploads/{session_id}/reconcile")
async def trigger_reconcile(
    session_id: int,
    body: ReconcileTrigger,
    session: AsyncSession = Depends(get_session),
):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    # Load new fields + levels
    new_fields = await upload_repo.get_fields_for_session(session, session_id)
    new_levels_by_field: dict[int, list] = {}
    for f in new_fields:
        new_levels_by_field[f.id] = await upload_repo.get_levels_for_field(session, f.id)

    # Load reference fields + levels
    ref_fields_raw = await dataset_repo.get_fields_with_levels(session, body.reference_dataset_id)
    # ref_fields_raw: list[tuple[Field, list[Level]]]
    ref_by_key = {f.field_key: (f, lvls) for f, lvls in ref_fields_raw}

    rows_to_create: list[dict] = []
    matched_ref_keys: set[str] = set()

    for uf in new_fields:
        # Make a transient Field for classification
        stub = Field(
            field_key=uf.field_key,
            display_name=uf.field_key,
            field_type=uf.override_type or uf.detected_type,
            dataset_id=0,
        )

        best_ref = None
        best_ref_lvls: list = []
        # Try exact key match first
        if uf.field_key in ref_by_key:
            best_ref, best_ref_lvls = ref_by_key[uf.field_key]
        else:
            # Find closest by edit distance
            for key, (rf, rl) in ref_by_key.items():
                d = reconciliation_service.edit_distance(uf.field_key, key)
                if d < 4:
                    best_ref, best_ref_lvls = rf, rl
                    break

        # Convert UploadLevel to stub Level objects for classify_row
        upload_lvls = new_levels_by_field.get(uf.id, [])
        stub_lvls = [
            LiveLevel(
                value=ul.raw_value, display_label=ul.raw_value, sort_order=ul.sort_order, field_id=0
            )
            for ul in upload_lvls
        ]

        result = reconciliation_service.classify_row(stub, stub_lvls, best_ref, best_ref_lvls)
        if best_ref:
            matched_ref_keys.add(best_ref.field_key)
        rows_to_create.append(
            {
                "upload_session_id": session_id,
                "upload_field_id": uf.id,
                "ref_field_id": best_ref.id if best_ref else None,
                "group": result.group,
                "status": result.status,
                "confidence": result.confidence,
                "note": result.note,
            }
        )

    # Old-only: reference fields not matched
    for key, (rf, _) in ref_by_key.items():
        if key not in matched_ref_keys:
            rows_to_create.append(
                {
                    "upload_session_id": session_id,
                    "upload_field_id": None,
                    "ref_field_id": rf.id,
                    "group": ReconciliationGroup.old_only,
                    "status": ReconciliationStatus.pending,
                    "confidence": None,
                    "note": "Present in reference, absent in new file",
                }
            )

    await reconciliation_repo.bulk_create_rows(session, rows_to_create)
    sess.reference_dataset_id = body.reference_dataset_id
    session.add(sess)
    await session.flush()
    return {"total": len(rows_to_create)}


@router.get("/uploads/{session_id}/reconcile")
async def list_reconcile_rows(
    session_id: int,
    group: ReconciliationGroup | None = None,
    after_id: int | None = None,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select

    from src.models.upload import UploadField

    rows = await reconciliation_repo.get_rows_page(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )
    next_cursor = rows[-1].id if len(rows) == page_size else None

    upload_field_ids = [r.upload_field_id for r in rows if r.upload_field_id]
    ref_field_ids = [r.ref_field_id for r in rows if r.ref_field_id]

    uf_map: dict[int, UploadField] = {}
    rf_map: dict[int, Field] = {}

    if upload_field_ids:
        ufs = list(
            (await session.execute(select(UploadField).where(UploadField.id.in_(upload_field_ids))))
            .scalars()
            .all()
        )
        uf_map = {u.id: u for u in ufs if u.id}

    if ref_field_ids:
        rfs = list(
            (await session.execute(select(Field).where(Field.id.in_(ref_field_ids))))
            .scalars()
            .all()
        )
        rf_map = {f.id: f for f in rfs if f.id}

    return {
        "items": [
            {
                "id": r.id,
                "group": r.group,
                "status": r.status,
                "upload_field_id": r.upload_field_id,
                "ref_field_id": r.ref_field_id,
                "field_key": uf_map[r.upload_field_id].field_key
                if r.upload_field_id and r.upload_field_id in uf_map
                else None,
                "field_type": (
                    uf_map[r.upload_field_id].override_type
                    or uf_map[r.upload_field_id].detected_type
                ).value
                if r.upload_field_id and r.upload_field_id in uf_map
                else None,
                "ref_field_key": rf_map[r.ref_field_id].field_key
                if r.ref_field_id and r.ref_field_id in rf_map
                else None,
                "confidence": r.confidence,
                "note": r.note,
            }
            for r in rows
        ],
        "next_cursor": next_cursor,
    }


@router.get("/uploads/{session_id}/reconcile/ids")
async def get_reconcile_ids(
    session_id: int,
    group: ReconciliationGroup | None = None,
    session: AsyncSession = Depends(get_session),
):
    ids = await reconciliation_repo.get_all_ids(session, session_id, group=group)
    return {"ids": ids}


@router.get("/uploads/{session_id}/reconcile/counts")
async def get_reconcile_counts(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    group_counts = await reconciliation_repo.get_counts_by_group(session, session_id)
    status_counts = await reconciliation_repo.get_status_counts(session, session_id)
    blocking_pending = await reconciliation_repo.get_blocking_pending_count(session, session_id)
    return {**group_counts, "status_counts": status_counts, "blocking_pending": blocking_pending}


@router.get("/uploads/{session_id}/suggested-reference")
async def get_suggested_reference(session_id: int, session: AsyncSession = Depends(get_session)):
    from sqlalchemy import select

    from src.models.dataset import Dataset

    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    if sess.collection_id is None:
        return {"dataset_id": None, "dataset_name": None}
    ds = (
        (
            await session.execute(
                select(Dataset)
                .where(Dataset.collection_id == sess.collection_id)
                .order_by(Dataset.id.desc())
                .limit(1)
            )
        )
        .scalars()
        .first()
    )
    if ds is None:
        return {"dataset_id": None, "dataset_name": None}
    return {"dataset_id": ds.id, "dataset_name": ds.name}


class RowResolve(BaseModel):
    ref_field_id: int | None = None
    upload_field_id: int | None = None
    status: ReconciliationStatus


@router.patch("/uploads/{session_id}/reconcile/{row_id}")
async def resolve_reconcile_row(
    session_id: int,
    row_id: int,
    body: RowResolve,
    session: AsyncSession = Depends(get_session),
):
    row = await reconciliation_repo.resolve_row(
        session,
        row_id,
        body.status,
        ref_field_id=body.ref_field_id,
        upload_field_id=body.upload_field_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Row not found")
    return {
        "id": row.id,
        "status": row.status,
        "upload_field_id": row.upload_field_id,
        "ref_field_id": row.ref_field_id,
    }


@router.post("/uploads/{session_id}/reconcile/bulk")
async def bulk_resolve_rows(
    session_id: int,
    body: BulkResolve,
    session: AsyncSession = Depends(get_session),
):
    resolved = await reconciliation_repo.bulk_resolve(session, session_id, body.ids, body.action)
    return {"resolved": resolved}


@router.post("/uploads/{session_id}/commit", status_code=201)
async def commit_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    try:
        dataset_id = await commit_service.commit_upload(session, session_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"dataset_id": dataset_id}


# --- Field tree ---


@router.get("/uploads/{session_id}/field-tree")
async def get_field_tree(session_id: int, session: AsyncSession = Depends(get_session)):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    groups = await upload_repo.get_fieldgroups_for_session(session, session_id)
    fields = await upload_repo.get_fields_for_session(session, session_id)

    def _group_dict(g):
        return {"id": g.id, "name": g.name, "parent_id": g.parent_id, "sort_order": g.sort_order}

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


# --- Field group CRUD ---


class FieldGroupCreate(BaseModel):
    name: str
    parent_id: int | None = None
    sort_order: int = 0


class FieldGroupUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    sort_order: int | None = None


@router.post("/uploads/{session_id}/fieldgroups", status_code=201)
async def create_fieldgroup(
    session_id: int,
    body: FieldGroupCreate,
    session: AsyncSession = Depends(get_session),
):
    sess = await upload_repo.get_session_by_id(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Upload session not found")
    grp = await upload_repo.create_upload_fieldgroup(
        session,
        upload_session_id=session_id,
        name=body.name,
        parent_id=body.parent_id,
        sort_order=body.sort_order,
    )
    return {
        "id": grp.id,
        "name": grp.name,
        "parent_id": grp.parent_id,
        "sort_order": grp.sort_order,
    }


@router.patch("/uploads/{session_id}/fieldgroups/{group_id}")
async def update_fieldgroup(
    session_id: int,
    group_id: int,
    body: FieldGroupUpdate,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select

    from src.models.upload import UploadFieldGroup

    grp = (
        (
            await session.execute(
                select(UploadFieldGroup).where(
                    UploadFieldGroup.id == group_id,
                    UploadFieldGroup.upload_session_id == session_id,
                )
            )
        )
        .scalars()
        .first()
    )
    if grp is None:
        raise HTTPException(status_code=404, detail="Group not found")
    if body.name is not None:
        grp.name = body.name
    if body.parent_id is not None:
        grp.parent_id = body.parent_id
    if body.sort_order is not None:
        grp.sort_order = body.sort_order
    session.add(grp)
    await session.flush()
    return {"id": grp.id, "name": grp.name, "parent_id": grp.parent_id}


@router.delete("/uploads/{session_id}/fieldgroups/{group_id}")
async def delete_fieldgroup(
    session_id: int,
    group_id: int,
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select, update

    from src.models.upload import UploadField, UploadFieldGroup

    grp = (
        (
            await session.execute(
                select(UploadFieldGroup).where(
                    UploadFieldGroup.id == group_id,
                    UploadFieldGroup.upload_session_id == session_id,
                )
            )
        )
        .scalars()
        .first()
    )
    if grp is None:
        raise HTTPException(status_code=404, detail="Group not found")
    # Unassign fields
    await session.execute(
        update(UploadField)
        .where(UploadField.upload_fieldgroup_id == group_id)
        .values(upload_fieldgroup_id=None)
    )
    await session.delete(grp)
    await session.flush()
    return {"deleted": group_id}


# --- Levels CRUD ---


class LevelUpsert(BaseModel):
    raw_value: str
    display_label: str | None = None
    sort_order: int = 0
    is_inherited: bool = False


@router.put("/uploads/{upload_session_id}/fields/{field_id}/levels", status_code=200)
async def upsert_level_route(
    upload_session_id: int,
    field_id: int,
    body: LevelUpsert,
    session: AsyncSession = Depends(get_session),
):
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != upload_session_id:
        raise HTTPException(status_code=404, detail="Field not found")
    level = await upload_repo.upsert_level(
        session,
        field_id=field_id,
        raw_value=body.raw_value,
        display_label=body.display_label,
        sort_order=body.sort_order,
        is_inherited=body.is_inherited,
    )
    return level


@router.delete(
    "/uploads/{upload_session_id}/fields/{field_id}/levels/{level_id}",
    status_code=204,
)
async def delete_level_route(
    upload_session_id: int,
    field_id: int,
    level_id: int,
    session: AsyncSession = Depends(get_session),
):
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != upload_session_id:
        raise HTTPException(status_code=404, detail="Field not found")
    deleted = await upload_repo.delete_level(session, field_id, level_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Level not found")


# --- Field move ---


class FieldMove(BaseModel):
    upload_fieldgroup_id: int | None


@router.patch("/uploads/{session_id}/fields/{field_id}/move")
async def move_field(
    session_id: int,
    field_id: int,
    body: FieldMove,
    session: AsyncSession = Depends(get_session),
):
    f = await upload_repo.get_field_by_id(session, field_id)
    if f is None or f.upload_session_id != session_id:
        raise HTTPException(status_code=404, detail="Field not found")
    f.upload_fieldgroup_id = body.upload_fieldgroup_id
    session.add(f)
    await session.flush()
    return {"id": f.id, "upload_fieldgroup_id": f.upload_fieldgroup_id}
