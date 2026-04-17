from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.field import Field, FieldType
from src.models.level import Level as LiveLevel
from src.models.reconciliation import ReconciliationGroup, ReconciliationStatus
from src.repositories import dataset_repo, reconciliation_repo, upload_repo
from src.services import reconciliation_service, upload_service
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
    try:
        result = await upload_service.create_upload_session(
            session,
            filename=file.filename or "upload.csv",
            content=content,
            content_type=file.content_type or "",
            dataset_name=dataset_name,
            collection_id=collection_id,
        )
    except InvalidFileTypeError:
        raise HTTPException(status_code=422, detail="Only CSV files are accepted") from None
    return result


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
        }
        for f in fields
    ]
    return {
        "id": sess.id,
        "status": sess.status.value,
        "dataset_name": sess.dataset_name,
        "collection_id": sess.collection_id,
        "row_count": sess.row_count,
        "fields": field_list,
    }


class FieldOverride(BaseModel):
    override_type: FieldType | None = None
    display_name: str | None = None


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
    session.add(f)
    await session.flush()
    return {
        "id": f.id,
        "field_key": f.field_key,
        "detected_type": f.detected_type.value,
        "override_type": f.override_type.value if f.override_type else None,
        "display_name": f.display_name,
    }


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
    rows = await reconciliation_repo.get_rows_page(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )
    next_cursor = rows[-1].id if len(rows) == page_size else None
    return {
        "items": [
            {
                "id": r.id,
                "group": r.group,
                "status": r.status,
                "upload_field_id": r.upload_field_id,
                "ref_field_id": r.ref_field_id,
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


class RowResolve(BaseModel):
    status: ReconciliationStatus
    ref_field_id: int | None = None


@router.patch("/uploads/{session_id}/reconcile/{row_id}")
async def resolve_reconcile_row(
    session_id: int,
    row_id: int,
    body: RowResolve,
    session: AsyncSession = Depends(get_session),
):
    row = await reconciliation_repo.resolve_row(
        session, row_id, body.status, ref_field_id=body.ref_field_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Row not found")
    return {"id": row.id, "status": row.status}


@router.post("/uploads/{session_id}/reconcile/bulk")
async def bulk_resolve_rows(
    session_id: int,
    body: BulkResolve,
    session: AsyncSession = Depends(get_session),
):
    resolved = await reconciliation_repo.bulk_resolve(session, session_id, body.ids, body.action)
    return {"resolved": resolved}


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

    def _field_dict(f):
        return {
            "id": f.id,
            "field_key": f.field_key,
            "display_name": f.display_name,
            "detected_type": f.detected_type.value,
            "override_type": f.override_type.value if f.override_type else None,
            "sort_order": f.sort_order,
            "upload_fieldgroup_id": f.upload_fieldgroup_id,
        }

    return {
        "groups": [_group_dict(g) for g in groups],
        "fields": [_field_dict(f) for f in fields if f.upload_fieldgroup_id is not None],
        "unassigned_fields": [_field_dict(f) for f in fields if f.upload_fieldgroup_id is None],
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
