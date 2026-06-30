// Public API envelopes — see docs/10_API_STANDARD.md §2.
// FROZEN as of contract version 0.1.0 (docs/06_PROJECT_STATE.md).

/** Metadata attached to every API response. */
export interface ApiResponseMeta {
  requestId: string;
  /** ISO-8601 UTC timestamp. */
  timestamp: string;
}

/** The standard success envelope. */
export interface ApiResponse<T> {
  data: T;
  meta: ApiResponseMeta;
}

/** The body of the standard error envelope. */
export interface ApiErrorBody {
  /** Stable, documented error code — clients branch on this, never on `message`. */
  code: string;
  message: string;
  retryable: boolean;
  /** Always safe to log — no PII, no provider/LLM internals (docs/11_SECURITY_GUIDE.md). */
  details?: unknown;
  requestId: string;
}

/** The standard error envelope. */
export interface ApiError {
  error: ApiErrorBody;
}
