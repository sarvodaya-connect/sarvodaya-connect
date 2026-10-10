/** ISO-8601 timestamp supplied by the API, for example 2026-10-10T08:30:00.000Z. */
export type IsoDateTime = string;

/** ISO-8601 calendar date supplied by the API, for example 2026-10-10. */
export type IsoDate = string;

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ValidationIssue {
  field: string;
  messages: string[];
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  details?: ValidationIssue[];
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}
