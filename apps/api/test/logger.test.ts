import { describe, expect, it } from 'vitest';
import { redact } from '../src/shared/logging/logger.js';

describe('logger redaction', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      user: 'alice',
      password: 'hunter2',
      nested: { authorization: 'Bearer abc', items: [{ token: 't0' }] },
    };
    expect(redact(input)).toEqual({
      user: 'alice',
      password: '[REDACTED]',
      nested: { authorization: '[REDACTED]', items: [{ token: '[REDACTED]' }] },
    });
  });

  it('passes through non-sensitive values', () => {
    expect(redact({ port: 3000, ok: true })).toEqual({ port: 3000, ok: true });
  });
});
