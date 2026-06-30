import { describe, it, expect } from 'vitest';
import { requireEnv } from './index.js';

describe('@lifeos/config requireEnv', () => {
  it('returns a present value', () => {
    expect(requireEnv('FOO', { FOO: 'bar' })).toBe('bar');
  });

  it('throws when a required value is missing', () => {
    expect(() => requireEnv('FOO', {})).toThrow(/Missing required configuration: FOO/);
  });
});
