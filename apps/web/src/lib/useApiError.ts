export interface ApiError {
  status: number
  code: string
  detail: string
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "status" in value &&
    "detail" in value &&
    typeof (value as Record<string, unknown>).code === "string" &&
    typeof (value as Record<string, unknown>).status === "number"
  )
}

const NOT_FOUND_CODES = new Set([
  "package_not_found",
  "collection_not_found",
  "dataset_not_found",
  "upload_session_not_found",
  "field_not_found",
  "field_group_not_found",
  "level_not_found",
  "reconciliation_row_not_found",
])

const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504])

export interface ApiErrorState {
  isApiError: boolean
  code: string | null
  detail: string | null
  isNotFound: boolean
  isRetryable: boolean
}

export function useApiError(error: unknown): ApiErrorState {
  if (!isApiError(error)) {
    return { isApiError: false, code: null, detail: null, isNotFound: false, isRetryable: false }
  }
  return {
    isApiError: true,
    code: error.code,
    detail: error.detail,
    isNotFound: NOT_FOUND_CODES.has(error.code),
    isRetryable: RETRYABLE_STATUSES.has(error.status),
  }
}
