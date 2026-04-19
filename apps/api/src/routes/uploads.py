from datetime import date

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.errors import (
    FieldGroupNotFoundError,
    FieldNotFoundError,
    LevelNotFoundError,
    UploadSessionNotFoundError,
)
from src.models.field import FieldType
from src.models.reconciliation import (
    BulkResolvedOut,
    ReconcileCountsOut,
    ReconcileIdsOut,
    ReconcileRowPage,
    ReconcileRowResolvedOut,
    ReconcileTriggerOut,
    ReconciliationGroup,
    ReconciliationStatus,
)
from src.models.upload import (
    CommitOut,
    DeletedOut,
    FieldGroupDetail,
    FieldMoveOut,
    SuggestedReferenceOut,
    UploadCreatedResponse,
    UploadFieldOverrideOut,
    UploadFieldTreeOut,
    UploadLevelRead,
    UploadSessionDetail,
    UploadSessionListResponse,
)
from src.repositories import reconciliation_repo
from src.services import upload_service
from src.services.upload_service import InvalidFileTypeError

router = APIRouter(tags=["uploads"])


@router.post("/uploads", status_code=201, response_model=UploadCreatedResponse)
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


@router.get("/uploads", response_model=UploadSessionListResponse)
async def list_upload_sessions(session: AsyncSession = Depends(get_session)):
    """List all non-committed, non-abandoned upload sessions (drafts)."""
    return await upload_service.list_upload_sessions(session)


@router.delete("/uploads/{session_id}", status_code=204)
async def discard_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    """Mark an upload session as abandoned (soft delete)."""
    try:
        await upload_service.discard_session(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


@router.get("/uploads/{session_id}", response_model=UploadSessionDetail)
async def get_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_upload_session(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


class FieldOverride(BaseModel):
    override_type: FieldType | None = None
    display_name: str | None = None
    upload_fieldgroup_id: int | None = None
    sort_order: int | None = None


@router.patch("/uploads/{session_id}/fields/{field_id}", response_model=UploadFieldOverrideOut)
async def override_field(
    session_id: int,
    field_id: int,
    body: FieldOverride,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.override_field(
            session,
            session_id,
            field_id,
            override_type=body.override_type,
            display_name=body.display_name,
            upload_fieldgroup_id=body.upload_fieldgroup_id,
            sort_order=body.sort_order,
            fieldgroup_id_set="upload_fieldgroup_id" in body.model_fields_set,
        )
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None


@router.delete("/uploads/{upload_session_id}/fields/{field_id}", status_code=204)
async def delete_field(
    upload_session_id: int,
    field_id: int,
    session: AsyncSession = Depends(get_session),
):
    try:
        await upload_service.delete_field(session, upload_session_id, field_id)
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None


class ReconcileTrigger(BaseModel):
    reference_dataset_id: int


class BulkResolve(BaseModel):
    ids: list[int]
    action: ReconciliationStatus  # confirmed | rejected | excluded


@router.post("/uploads/{session_id}/reconcile", response_model=ReconcileTriggerOut)
async def trigger_reconcile(
    session_id: int,
    body: ReconcileTrigger,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.trigger_reconcile(
            session, session_id, body.reference_dataset_id
        )
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


@router.get("/uploads/{session_id}/reconcile", response_model=ReconcileRowPage)
async def list_reconcile_rows(
    session_id: int,
    group: ReconciliationGroup | None = None,
    after_id: int | None = None,
    page_size: int = 50,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.list_reconcile_rows(
        session, session_id, group=group, after_id=after_id, page_size=page_size
    )


@router.get("/uploads/{session_id}/reconcile/ids", response_model=ReconcileIdsOut)
async def get_reconcile_ids(
    session_id: int,
    group: ReconciliationGroup | None = None,
    session: AsyncSession = Depends(get_session),
):
    # Exception: calls repo directly — this is a pure ID projection with no business logic.
    # No existence check is needed: a missing session_id returns an empty list, which is correct
    # behaviour for this pagination-support endpoint.
    ids = await reconciliation_repo.get_all_ids(session, session_id, group=group)
    return ReconcileIdsOut(ids=ids)


@router.get("/uploads/{session_id}/reconcile/counts", response_model=ReconcileCountsOut)
async def get_reconcile_counts(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_reconcile_counts(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


@router.get("/uploads/{session_id}/suggested-reference", response_model=SuggestedReferenceOut)
async def get_suggested_reference(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_suggested_reference(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


class RowResolve(BaseModel):
    ref_field_id: int | None = None
    upload_field_id: int | None = None
    status: ReconciliationStatus


@router.patch("/uploads/{session_id}/reconcile/{row_id}", response_model=ReconcileRowResolvedOut)
async def resolve_reconcile_row(
    session_id: int,
    row_id: int,
    body: RowResolve,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.resolve_reconcile_row(
            session,
            session_id,
            row_id,
            body.status,
            ref_field_id=body.ref_field_id,
            upload_field_id=body.upload_field_id,
        )
    except LevelNotFoundError:
        raise HTTPException(status_code=404, detail="Row not found") from None


@router.post("/uploads/{session_id}/reconcile/bulk", response_model=BulkResolvedOut)
async def bulk_resolve_rows(
    session_id: int,
    body: BulkResolve,
    session: AsyncSession = Depends(get_session),
):
    return await upload_service.bulk_resolve_rows(session, session_id, body.ids, body.action)


@router.post("/uploads/{session_id}/commit", status_code=201, response_model=CommitOut)
async def commit_upload_session(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        dataset_id = await upload_service.commit(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None
    except Exception as exc:
        # Exception: catch-all safety net for commit — the commit service coordinates
        # many sub-operations (migration, reconciliation, dataset creation) and can surface
        # unexpected errors. Prefer typed domain errors for new failure modes here.
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return CommitOut(dataset_id=dataset_id)


# --- Field tree ---


@router.get("/uploads/{session_id}/field-tree", response_model=UploadFieldTreeOut)
async def get_field_tree(session_id: int, session: AsyncSession = Depends(get_session)):
    try:
        return await upload_service.get_field_tree(session, session_id)
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


# --- Field group CRUD ---


class FieldGroupCreate(BaseModel):
    name: str
    parent_id: int | None = None
    sort_order: int = 0


class FieldGroupUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    sort_order: int | None = None


@router.post("/uploads/{session_id}/fieldgroups", status_code=201, response_model=FieldGroupDetail)
async def create_fieldgroup(
    session_id: int,
    body: FieldGroupCreate,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.create_fieldgroup(
            session,
            session_id,
            name=body.name,
            parent_id=body.parent_id,
            sort_order=body.sort_order,
        )
    except UploadSessionNotFoundError:
        raise HTTPException(status_code=404, detail="Upload session not found") from None


@router.patch("/uploads/{session_id}/fieldgroups/{group_id}", response_model=FieldGroupDetail)
async def update_fieldgroup(
    session_id: int,
    group_id: int,
    body: FieldGroupUpdate,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.update_fieldgroup(
            session,
            session_id,
            group_id,
            name=body.name,
            parent_id=body.parent_id,
            parent_id_set="parent_id" in body.model_fields_set,
            sort_order=body.sort_order,
        )
    except FieldGroupNotFoundError:
        raise HTTPException(status_code=404, detail="Group not found") from None


@router.delete("/uploads/{session_id}/fieldgroups/{group_id}", response_model=DeletedOut)
async def delete_fieldgroup(
    session_id: int,
    group_id: int,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.delete_fieldgroup_svc(session, session_id, group_id)
    except FieldGroupNotFoundError:
        raise HTTPException(status_code=404, detail="Group not found") from None


# --- Levels CRUD ---


class LevelUpsert(BaseModel):
    raw_value: str
    display_label: str | None = None
    sort_order: int = 0
    is_inherited: bool = False


@router.put(
    "/uploads/{upload_session_id}/fields/{field_id}/levels",
    status_code=200,
    response_model=UploadLevelRead,
)
async def upsert_level_route(
    upload_session_id: int,
    field_id: int,
    body: LevelUpsert,
    session: AsyncSession = Depends(get_session),
):
    try:
        level = await upload_service.upsert_level(
            session,
            upload_session_id,
            field_id,
            raw_value=body.raw_value,
            display_label=body.display_label,
            sort_order=body.sort_order,
            is_inherited=body.is_inherited,
        )
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
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
    try:
        await upload_service.delete_level(session, upload_session_id, field_id, level_id)
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
    except LevelNotFoundError:
        raise HTTPException(status_code=404, detail="Level not found") from None


# --- Field move ---


class FieldMove(BaseModel):
    upload_fieldgroup_id: int | None


@router.patch("/uploads/{session_id}/fields/{field_id}/move", response_model=FieldMoveOut)
async def move_field(
    session_id: int,
    field_id: int,
    body: FieldMove,
    session: AsyncSession = Depends(get_session),
):
    try:
        return await upload_service.move_field(
            session, session_id, field_id, body.upload_fieldgroup_id
        )
    except FieldNotFoundError:
        raise HTTPException(status_code=404, detail="Field not found") from None
