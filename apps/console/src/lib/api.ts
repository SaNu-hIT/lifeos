// Minimal typed client for the LifeOS read-only console API (docs/10). Mirrors the web
// app's client; kept local so the console app stays self-contained.

import type { ApiResponse, ApiError } from '@lifeos/contracts';

export class ApiClientError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function isApiError(body: unknown): body is ApiError {
  return typeof body === 'object' && body !== null && 'error' in body;
}

export function unwrap<T>(body: unknown, status: number): T {
  if (isApiError(body)) throw new ApiClientError(body.error.code, body.error.message, status);
  return (body as ApiResponse<T>).data;
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
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
    async post<T>(path: string, payload?: unknown): Promise<T> {
      const { body, status } = await request(path, {
        method: 'POST',
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      return unwrap<T>(body, status);
    },
  };
}
