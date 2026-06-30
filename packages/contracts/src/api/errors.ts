// The platform-wide typed error — see docs/03_LifeOS_Engineering_Handbook.md §5.
// FROZEN as of contract version 0.1.0.

/** Canonical, stable error codes. Clients and tools branch on these. */
export const ErrorCodes = {
  INTERNAL: 'INTERNAL',
  VALIDATION_INVALID: 'VALIDATION_INVALID',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  DEPENDENCY_UNAVAILABLE: 'DEPENDENCY_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes] | (string & {});

export interface LifeOSErrorOptions {
  code: ErrorCode;
  /** HTTP status to surface when this error reaches the API edge. */
  status: number;
  message: string;
  retryable?: boolean;
  /** Safe, non-sensitive context only. */
  details?: unknown;
  cause?: unknown;
}

/**
 * The single typed error used across the platform. Domain code throws domain
 * errors; adapters translate them to `LifeOSError`; the API edge renders it as
 * the standard error envelope (docs/10_API_STANDARD.md §2).
 */
export class LifeOSError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(options: LifeOSErrorOptions) {
    super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'LifeOSError';
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }

  static isLifeOSError(value: unknown): value is LifeOSError {
    return value instanceof LifeOSError;
  }
}
