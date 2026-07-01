// Typed client for the LifeOS public API (docs/10_API_STANDARD.md). All responses are
// the standard envelope; this unwraps `data`/`page` and turns the error envelope into a
// thrown `ApiClientError` clients can branch on by `code`.

import type { ApiError, ApiPage, ApiResponse } from '@lifeos/contracts';

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Join a base URL and a path without doubling or dropping the slash. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body;
}

/** Pull `data` from a success envelope, or throw the standard error envelope. */
export function unwrap<T>(body: unknown, status: number): T {
  if (isApiError(body)) {
    const e = body.error;
    throw new ApiClientError(e.code, e.message, e.retryable, status);
  }
  return (body as ApiResponse<T>).data;
}

/** Pull items + cursor from a paginated envelope (phase 28). */
export function unwrapPage<T>(body: unknown, status: number): { items: T[]; nextCursor?: string } {
  if (isApiError(body)) {
    const e = body.error;
    throw new ApiClientError(e.code, e.message, e.retryable, status);
  }
  const p = body as ApiPage<T>;
  return { items: p.data, nextCursor: p.page.nextCursor };
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  getPage<T>(path: string): Promise<{ items: T[]; nextCursor?: string }>;
  post<T>(path: string, payload?: unknown): Promise<T>;
}

export function createApiClient(baseUrl: string, getToken: () => string | null): ApiClient {
  async function request(path: string, init: RequestInit): Promise<{ body: unknown; status: number }> {
    const token = getToken();
    const res = await fetch(joinUrl(baseUrl, path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = res.status === 204 ? undefined : await res.json().catch(() => undefined);
    return { body, status: res.status };
  }

  return {
    async get<T>(path: string): Promise<T> {
      const { body, status } = await request(path, { method: 'GET' });
      return unwrap<T>(body, status);
    },
    async getPage<T>(path: string): Promise<{ items: T[]; nextCursor?: string }> {
      const { body, status } = await request(path, { method: 'GET' });
      return unwrapPage<T>(body, status);
    },
    async post<T>(path: string, payload?: unknown): Promise<T> {
      const { body, status } = await request(path, {
        method: 'POST',
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      return unwrap<T>(body, status);
    },
  };
}
