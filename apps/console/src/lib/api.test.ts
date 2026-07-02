import { describe, expect, it } from 'vitest';
import { ApiClientError, joinUrl, unwrap } from './api';

describe('console api client', () => {
  it('joins urls cleanly', () => {
    expect(joinUrl('http://x/', '/v1/console/skills')).toBe('http://x/v1/console/skills');
  });

  it('unwraps success and throws standard errors', () => {
    expect(unwrap<number[]>({ data: [1, 2], meta: {} }, 200)).toEqual([1, 2]);
    expect(() => unwrap({ error: { code: 'UNAUTHENTICATED', message: 'no' } }, 401)).toThrow(
      ApiClientError,
    );
  });
});
