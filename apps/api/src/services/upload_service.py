"""Orchestrates file save + field detection + upload_session creation."""

import csv
import io
import os
import tempfile
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.field import FieldType
from src.models.upload import UploadSessionStatus
from src.repositories import upload_repo
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
