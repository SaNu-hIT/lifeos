import type { ApiPage, ApiResponse } from '@lifeos/contracts';
import { getRequestId } from '../context/request-context.js';

function meta() {
  return {
    requestId: getRequestId() ?? 'req_unknown',
    timestamp: new Date().toISOString(),
  };
}

/** Wrap data in the standard success envelope (docs/10_API_STANDARD.md §2). */
export function ok<T>(data: T): ApiResponse<T> {
  return { data, meta: meta() };
}

/** Wrap a page of items in the standard paginated envelope (docs/10_API_STANDARD.md §3).
 *  Items sit at the top level (no `data.data` nesting); the cursor lives in `page`. */
export function page<T>(items: T[], nextCursor?: string): ApiPage<T> {
  return { data: items, page: { nextCursor }, meta: meta() };
}
