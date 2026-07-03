import { describe, expect, it } from 'vitest';
import { INSECURE_JWT_SECRET, loadAppConfig } from '../src/config/app-config.js';

const base = {
  DATABASE_URL: 'postgres://localhost:5432/x',
  REDIS_URL: 'redis://localhost:6379',
};

describe('Phase 35 — config security guards', () => {
  it('rejects the dev JWT secret in production', () => {
    expect(() =>
      loadAppConfig({ ...base, NODE_ENV: 'production', AUTH_JWT_SECRET: INSECURE_JWT_SECRET }),
    ).toThrow(/AUTH_JWT_SECRET/);
  });

  it('accepts a strong secret in production', () => {
    const cfg = loadAppConfig({
      ...base,
      NODE_ENV: 'production',
      AUTH_JWT_SECRET: 'a-sufficiently-long-production-secret',
    });
    expect(cfg.NODE_ENV).toBe('production');
  });

  it('allows the dev default outside production', () => {
    const cfg = loadAppConfig({ ...base, NODE_ENV: 'development' });
    expect(cfg.AUTH_JWT_SECRET).toBe(INSECURE_JWT_SECRET);
  });

  it('defaults the body-size limit', () => {
    expect(loadAppConfig({ ...base }).MAX_BODY_SIZE).toBe('1mb');
  });

  it('rejects AI_PROVIDER=openai without an API key', () => {
    expect(() => loadAppConfig({ ...base, AI_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });

  it('accepts AI_PROVIDER=openai with an API key and defaults the model', () => {
    const cfg = loadAppConfig({ ...base, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'sk-test' });
    expect(cfg.OPENAI_MODEL).toBe('gpt-4o-mini');
    expect(cfg.OPENAI_EMBED_MODEL).toBe('text-embedding-3-small');
  });
});
