import { describe, it, expect } from 'vitest';
import { requireEnv, loadConfig, z } from './index.js';

describe('@lifeos/config requireEnv', () => {
  it('returns a present value', () => {
    expect(requireEnv('FOO', { FOO: 'bar' })).toBe('bar');
  });

  it('throws when a required value is missing', () => {
    expect(() => requireEnv('FOO', {})).toThrow(/Missing required configuration: FOO/);
  });
});

describe('@lifeos/config loadConfig', () => {
  const schema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  });

  it('parses and coerces a valid source', () => {
    expect(loadConfig(schema, { PORT: '8080', NODE_ENV: 'production' })).toEqual({
      PORT: 8080,
      NODE_ENV: 'production',
    });
  });

  it('applies defaults', () => {
    expect(loadConfig(schema, {})).toEqual({ PORT: 3000, NODE_ENV: 'development' });
  });

  it('fails fast with an aggregated message on invalid config', () => {
    expect(() => loadConfig(schema, { PORT: 'not-a-number', NODE_ENV: 'staging' })).toThrow(
      /Invalid configuration:.*PORT.*NODE_ENV|Invalid configuration:/,
    );
  });
});
