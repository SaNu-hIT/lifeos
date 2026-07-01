// Standard cursor pagination for list endpoints — see docs/10_API_STANDARD.md §3.
// Every paginated endpoint returns items at the top level (not nested under another
// `data`) plus a `page` block carrying the opaque forward cursor.

import type { ApiResponseMeta } from './envelope.js';

export interface PageInfo {
  /** Opaque cursor for the next page; absent when there are no more items. */
  nextCursor?: string;
}

/** The standard paginated success envelope. */
export interface ApiPage<T> {
  data: T[];
  page: PageInfo;
  meta: ApiResponseMeta;
}
