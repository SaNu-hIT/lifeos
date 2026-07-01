import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main.js';

describe('Phase 28 — API gateway hardening (e2e)', () => {
  describe('security headers', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createApp();
      await app.init();
    });
    afterAll(async () => {
      await app.close();
    });

    it('sets conservative security headers on every response', async () => {
      const res = await request(app.getHttpServer()).get('/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['content-security-policy']).toContain("default-src 'none'");
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('rate limiting', () => {
    const prev = process.env.RATE_LIMIT_RPM;
    let app: INestApplication;

    beforeAll(async () => {
      process.env.RATE_LIMIT_RPM = '2'; // read by loadAppConfig() at module construction
      app = await createApp();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    afterEach(() => {
      if (prev === undefined) delete process.env.RATE_LIMIT_RPM;
      else process.env.RATE_LIMIT_RPM = prev;
    });

    it('returns 429 with the RATE_LIMITED envelope once the limit is exceeded', async () => {
      const server = app.getHttpServer();
      const first = await request(server).get('/v1/health');
      const second = await request(server).get('/v1/health');
      const third = await request(server).get('/v1/health');

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(third.status).toBe(429);
      expect(third.body.error.code).toBe('RATE_LIMITED');
      expect(third.body.error.retryable).toBe(true);
      expect(third.headers['retry-after']).toBeDefined();
    });
  });
});
