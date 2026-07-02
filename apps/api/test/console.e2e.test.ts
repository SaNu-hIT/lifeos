import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { runMigrations } from '../src/shared/database/migrate.js';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 31 — developer console (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    process.env.DATABASE_URL = TEST_DB_URL;
    const { createApp } = await import('../src/main.js');
    app = await createApp();
    await app.init();

    const session = await request(app.getHttpServer())
      .post('/v1/auth/session')
      .send({ email: `console_${Date.now()}@test.local` });
    token = session.body.data.token;
    userId = session.body.data.userId;
    // Provision the user row (context assembly reads it) — same as a first real login.
    await request(app.getHttpServer()).get('/v1/me').set('authorization', `Bearer ${token}`);
  });

  afterAll(async () => {
    const db = new PgDatabaseAdapter(TEST_DB_URL);
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
    await app.close();
  });

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer()).get('/v1/console/skills');
    expect(res.status).toBe(401);
  });

  it('lists registered skills (empty in the core; installed at composition)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/console/skills')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.requestId).toBeTruthy();
  });

  it('lists connectors with health and returns the caller capabilities', async () => {
    const connectors = await request(app.getHttpServer())
      .get('/v1/console/connectors')
      .set('authorization', `Bearer ${token}`);
    expect(connectors.status).toBe(200);
    expect(Array.isArray(connectors.body.data)).toBe(true);

    const caps = await request(app.getHttpServer())
      .get('/v1/console/capabilities')
      .set('authorization', `Bearer ${token}`);
    expect(caps.status).toBe(200);
    expect(Array.isArray(caps.body.data)).toBe(true); // fresh user → no grants yet
  });

  it('assembles and returns the Unified Context for inspection', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/console/context?scope=core')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(userId);
    expect(res.body.data).toHaveProperty('memory');
    expect(res.body.data).toHaveProperty('capabilities');
  });
});
