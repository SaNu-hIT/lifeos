import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { runMigrations } from '../src/shared/database/migrate.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 35 — security hardening (e2e)', () => {
  let app: INestApplication;
  const prevBody = process.env.MAX_BODY_SIZE;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.MAX_BODY_SIZE = '256b'; // tiny, to exercise the 413 path
    const { createApp } = await import('../src/main.js');
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    if (prevBody === undefined) delete process.env.MAX_BODY_SIZE;
    else process.env.MAX_BODY_SIZE = prevBody;
    await app.close();
  });

  it('rejects unknown DTO properties (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/session')
      .send({ email: 'ok@test.local', smuggled: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_INVALID');
  });

  it('rejects an oversized request body with 413', async () => {
    const big = { email: 'x@test.local', pad: 'A'.repeat(2000) };
    const res = await request(app.getHttpServer()).post('/v1/auth/session').send(big);
    expect(res.status).toBe(413);
  });

  it('still accepts a well-formed request', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/session')
      .send({ email: 'good@test.local' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
  });
});
