import { describe, expect, it } from 'vitest';
import { ApiClientError, joinUrl, unwrap, unwrapPage } from './api';

describe('web api client helpers', () => {
  it('joins urls without doubling slashes', () => {
    expect(joinUrl('http://x/', '/v1/home')).toBe('http://x/v1/home');
    expect(joinUrl('http://x', 'v1/home')).toBe('http://x/v1/home');
  });

  it('unwraps a success envelope', () => {
    const data = unwrap<{ status: string }>({ data: { status: 'ok' }, meta: {} }, 200);
    expect(data).toEqual({ status: 'ok' });
  });

  it('throws the standard error envelope as ApiClientError', () => {
    const body = { error: { code: 'RATE_LIMITED', message: 'slow down', retryable: true } };
    try {
      unwrap(body, 429);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiClientError);
      expect((e as ApiClientError).code).toBe('RATE_LIMITED');
      expect((e as ApiClientError).retryable).toBe(true);
      expect((e as ApiClientError).status).toBe(429);
    }
  });

  it('unwraps a paginated envelope', () => {
    const page = unwrapPage<number>({ data: [1, 2], page: { nextCursor: 'c1' }, meta: {} }, 200);
    expect(page).toEqual({ items: [1, 2], nextCursor: 'c1' });
  });
});
