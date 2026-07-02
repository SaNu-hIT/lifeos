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
});
