from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.models.field import FieldType
from src.repositories import upload_repo
from src.services import upload_service
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
