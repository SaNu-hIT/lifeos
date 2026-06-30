import { describe, expect, it, vi } from 'vitest';
import type { ArgumentsHost } from '@nestjs/common';
import { LifeOSError } from '@lifeos/contracts';
import { AllExceptionsFilter } from '../src/shared/http/all-exceptions.filter.js';

function fakeHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('renders a LifeOSError with its code, status, retryable and details', () => {
    const { host, status, json } = fakeHost();
    filter.catch(
      new LifeOSError({
        code: 'PERMISSION_DENIED',
        status: 403,
        message: 'Missing capability',
        details: { requiredCapability: 'grocery.order' },
      }),
      host,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'PERMISSION_DENIED',
        message: 'Missing capability',
        retryable: false,
        details: { requiredCapability: 'grocery.order' },
      }),
    });
  });

  it('does not leak internals for an unknown error', () => {
    const { host, status, json } = fakeHost();
    filter.catch(new Error('secret stack detail from a provider'), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.message).toBe('Unexpected error');
    expect(body.error.message).not.toContain('secret');
    expect(body.error.details).toBeUndefined();
  });
});
