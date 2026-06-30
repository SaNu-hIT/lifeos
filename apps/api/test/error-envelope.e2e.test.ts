import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/main.js';

describe('error envelope (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('renders unknown routes as the standard error envelope', async () => {
    const res = await request(app.getHttpServer()).get('/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', retryable: false });
    expect(typeof res.body.error.message).toBe('string');
    expect(typeof res.body.error.requestId).toBe('string');
    // No success envelope fields leak into an error response.
    expect(res.body.data).toBeUndefined();
  });
});
