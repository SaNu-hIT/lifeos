import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { runMigrations } from '../src/shared/database/migrate.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 33 — observability (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    process.env.DATABASE_URL = TEST_DB_URL;
    const { createApp } = await import('../src/main.js');
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('records HTTP request metrics and exposes them at /v1/metrics', async () => {
    await request(app.getHttpServer()).get('/v1/health');
    const res = await request(app.getHttpServer()).get('/v1/metrics');
    expect(res.status).toBe(200);
    const counters = res.body.data.counters as Record<string, number>;
    const requestSeries = Object.keys(counters).filter((k) => k.startsWith('http_requests_total'));
    expect(requestSeries.length).toBeGreaterThan(0);
    // A latency histogram was recorded too.
    expect(Object.keys(res.body.data.histograms).some((k) => k.startsWith('http_request_duration_ms'))).toBe(true);
  });

  it('reports deep readiness (db + redis up)', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ ready: true, checks: { database: 'up', redis: 'up' } });
  });
});
