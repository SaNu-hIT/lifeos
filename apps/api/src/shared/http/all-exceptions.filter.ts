import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import { type ApiError, ErrorCodes, LifeOSError } from '@lifeos/contracts';
import type { Response } from 'express';
import { getRequestId } from '../context/request-context.js';

function mapHttpStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_INVALID;
    case 401:
      return ErrorCodes.UNAUTHENTICATED;
    case 403:
      return ErrorCodes.PERMISSION_DENIED;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMITED;
    case 503:
      return ErrorCodes.DEPENDENCY_UNAVAILABLE;
    default:
      return ErrorCodes.INTERNAL;
  }
}

/**
 * Renders every uncaught exception as the standard error envelope
 * (docs/10_API_STANDARD.md §2). Unknown errors are never leaked verbatim — the
 * message is generic and details are omitted (docs/11_SECURITY_GUIDE.md).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = getRequestId() ?? 'req_unknown';

    let status = 500;
    let code: string = ErrorCodes.INTERNAL;
    let message = 'Unexpected error';
    let retryable = true;
    let details: unknown;

    if (LifeOSError.isLifeOSError(exception)) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      retryable = exception.retryable;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = mapHttpStatusToCode(status);
      message = exception.message;
      retryable = status >= 500;
    }

    const body: ApiError = { error: { code, message, retryable, details, requestId } };
    response.status(status).json(body);
  }
}
