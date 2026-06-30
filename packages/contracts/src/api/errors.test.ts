import { describe, it, expect } from 'vitest';
import { LifeOSError, ErrorCodes } from './errors.js';

describe('LifeOSError', () => {
  it('carries code, status, retryable and details', () => {
    const err = new LifeOSError({
      code: ErrorCodes.PERMISSION_DENIED,
      status: 403,
      message: 'Missing capability',
      details: { requiredCapability: 'grocery.order' },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('PERMISSION_DENIED');
    expect(err.status).toBe(403);
    expect(err.retryable).toBe(false);
    expect(err.details).toEqual({ requiredCapability: 'grocery.order' });
  });

  it('defaults retryable to false and supports a cause', () => {
    const cause = new Error('boom');
    const err = new LifeOSError({ code: ErrorCodes.INTERNAL, status: 500, message: 'x', cause });
    expect(err.retryable).toBe(false);
    expect(err.cause).toBe(cause);
  });

  it('type-guards via isLifeOSError', () => {
    expect(LifeOSError.isLifeOSError(new LifeOSError({ code: 'X', status: 400, message: 'y' }))).toBe(true);
    expect(LifeOSError.isLifeOSError(new Error('plain'))).toBe(false);
  });
});
