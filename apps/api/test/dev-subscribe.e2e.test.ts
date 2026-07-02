import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { runMigrations } from '../src/shared/database/migrate.js';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 37 — dev subscribe grants capabilities (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL); // applies 0017 seed (capabilities + plans)
    process.env.DATABASE_URL = TEST_DB_URL;
    const { createApp } = await import('../src/main.js');
    app = await createApp();
    await app.init();
    const session = await request(app.getHttpServer())
      .post('/v1/auth/session')
      .send({ email: `dev_${Date.now()}@test.local` });
    token = session.body.data.token;
    userId = session.body.data.userId;
    await request(app.getHttpServer()).get('/v1/me').set('authorization', `Bearer ${token}`);
  });

  afterAll(async () => {
    const db = new PgDatabaseAdapter(TEST_DB_URL);
    await db.query('delete from billing.capability_grants where user_id = $1', [userId]);
    await db.query('delete from billing.subscriptions where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
    await app.close();
  });

  it('starts with no capabilities (deny-by-default)', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/console/capabilities')
      .set('authorization', `Bearer ${token}`);
    expect(res.body.data).toEqual([]);
  });

  it('subscribing to pro materializes the plan capabilities', async () => {
    const sub = await request(app.getHttpServer())
      .post('/v1/dev/subscribe')
      .set('authorization', `Bearer ${token}`)
      .send({ planKey: 'pro' });
    expect(sub.status).toBe(201);

    const caps = await request(app.getHttpServer())
      .get('/v1/console/capabilities')
      .set('authorization', `Bearer ${token}`);
    expect(caps.body.data).toEqual(
      expect.arrayContaining(['grocery.read', 'grocery.order', 'calendar.read', 'calendar.write']),
    );
  });

  it('rejects unknown DTO fields (validation) and an unauthenticated call', async () => {
    const bad = await request(app.getHttpServer())
      .post('/v1/dev/subscribe')
      .set('authorization', `Bearer ${token}`)
      .send({ planKey: 'pro', extra: 'x' });
    expect(bad.status).toBe(400);

    const anon = await request(app.getHttpServer()).post('/v1/dev/subscribe').send({ planKey: 'pro' });
    expect(anon.status).toBe(401);
  });
});
