from src.errors import (
    AIServiceError,
    CollectionNotFoundError,
    DatasetNotFoundError,
    FieldGroupNotFoundError,
    FieldNotFoundError,
    InvalidFileTypeError,
    LevelNotFoundError,
    PackageNotFoundError,
    ReconciliationRowNotFoundError,
    UploadSessionNotFoundError,
)


def test_all_domain_errors_have_metadata():
    cases = [
        (PackageNotFoundError, 404, "package_not_found"),
        (CollectionNotFoundError, 404, "collection_not_found"),
        (DatasetNotFoundError, 404, "dataset_not_found"),
        (UploadSessionNotFoundError, 404, "upload_session_not_found"),
        (FieldNotFoundError, 404, "field_not_found"),
        (FieldGroupNotFoundError, 404, "field_group_not_found"),
        (LevelNotFoundError, 404, "level_not_found"),
        (ReconciliationRowNotFoundError, 404, "reconciliation_row_not_found"),
        (AIServiceError, 502, "ai_service_error"),
        (InvalidFileTypeError, 422, "invalid_file_type"),
    ]
    for cls, expected_status, expected_code in cases:
        err = cls()
        assert err.status_code == expected_status, f"{cls.__name__}.status_code"
        assert err.code == expected_code, f"{cls.__name__}.code"
