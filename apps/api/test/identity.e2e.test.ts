import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { runMigrations } from '../src/shared/database/migrate.js';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';

const TEST_DB_URL =
  process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

async function ensureDatabase(url: string): Promise<void> {
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [dbName]);
    if (!rowCount) await client.query(`create database ${dbName}`);
  } finally {
    await client.end();
  }
}

describe('Phase 05 — identity & auth (e2e)', () => {
  let app: INestApplication;
  let createdUserId: string | undefined;

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    // Point the app's database at the test DB before the module instantiates its pool.
    process.env.DATABASE_URL = TEST_DB_URL;
    const { createApp } = await import('../src/main.js');
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    if (createdUserId) {
      const db = new PgDatabaseAdapter(TEST_DB_URL);
      await db.query('delete from platform.users where id = $1', [createdUserId]);
      await db.close();
    }
    await app.close();
  });

  it('rejects an unauthenticated request to /v1/me with 401', async () => {
    const res = await request(app.getHttpServer()).get('/v1/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('mints a dev token, then provisions + returns the user on /v1/me', async () => {
    const email = `me_${Date.now()}@test.local`;
    const session = await request(app.getHttpServer())
      .post('/v1/auth/session')
      .send({ email });
    expect(session.status).toBe(201);
    const { token, userId } = session.body.data as { token: string; userId: string };
    createdUserId = userId;

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ id: userId, email });
    expect(me.body.meta.requestId).toBeTruthy();
  });

  it('the authenticated id is what RLS sees (auth.uid() alignment)', async () => {
    // Re-fetch as the user via user-context: RLS must return exactly that one row.
    const db = new PgDatabaseAdapter(TEST_DB_URL);
    try {
      const rows = await db.transaction(
        (tx) => tx.query<{ id: string }>('select id from platform.users'),
        { as: 'user', userId: createdUserId! },
      );
      expect(rows.rows).toEqual([{ id: createdUserId }]);
    } finally {
      await db.close();
    }
  });

  it('rejects a malformed token with 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });
});
