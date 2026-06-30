import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main.js';

describe('GET /v1/health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the standard success envelope with a requestId', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok' });
    expect(typeof res.body.data.uptimeSec).toBe('number');
    expect(typeof res.body.meta.requestId).toBe('string');
    expect(res.body.meta.requestId.length).toBeGreaterThan(0);
    expect(typeof res.body.meta.timestamp).toBe('string');
    // requestId is also surfaced on the response header.
    expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
  });

  it('echoes an incoming x-request-id', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/health')
      .set('x-request-id', 'req_test_123');
    expect(res.body.meta.requestId).toBe('req_test_123');
  });
});
