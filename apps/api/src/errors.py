class DomainError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class PackageNotFoundError(DomainError):
    status_code = 404
    code = "package_not_found"


class CollectionNotFoundError(DomainError):
    status_code = 404
    code = "collection_not_found"


class DatasetNotFoundError(DomainError):
    status_code = 404
    code = "dataset_not_found"


class UploadSessionNotFoundError(DomainError):
    status_code = 404
    code = "upload_session_not_found"


class FieldNotFoundError(DomainError):
    status_code = 404
    code = "field_not_found"


class FieldGroupNotFoundError(DomainError):
    status_code = 404
    code = "field_group_not_found"


class LevelNotFoundError(DomainError):
    status_code = 404
    code = "level_not_found"


class ReconciliationRowNotFoundError(DomainError):
    status_code = 404
    code = "reconciliation_row_not_found"


class AIServiceError(DomainError):
    status_code = 502
    code = "ai_service_error"


class InvalidFileTypeError(DomainError):
    status_code = 422
    code = "invalid_file_type"
