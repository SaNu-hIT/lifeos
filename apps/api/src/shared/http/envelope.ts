import type { ApiResponse } from '@lifeos/contracts';
import { getRequestId } from '../context/request-context.js';

/** Wrap data in the standard success envelope (docs/10_API_STANDARD.md §2). */
export function ok<T>(data: T): ApiResponse<T> {
  return {
    data,
    meta: {
      requestId: getRequestId() ?? 'req_unknown',
      timestamp: new Date().toISOString(),
    },
  };
}
