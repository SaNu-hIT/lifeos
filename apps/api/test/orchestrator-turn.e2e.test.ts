import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import request from 'supertest';
import { runMigrations } from '../src/shared/database/migrate.js';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

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

describe('Phase 16 — full turn through HTTP (e2e)', () => {
  let app: INestApplication;
  let userId: string | undefined;

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    process.env.DATABASE_URL = TEST_DB_URL;
    const { createApp } = await import('../src/main.js');
    app = await createApp();
    await app.init();
  });

  afterAll(async () => {
    if (userId) {
      const db = new PgDatabaseAdapter(TEST_DB_URL);
      await db.query('delete from memory.summaries where user_id = $1', [userId]);
      await db.query('delete from conversation.messages where user_id = $1', [userId]);
      await db.query('delete from conversation.conversations where user_id = $1', [userId]);
      await db.query('delete from platform.users where id = $1', [userId]);
      await db.close();
    }
    await app.close();
  });

  it('drives a conversational turn end-to-end (message → assistant reply → history)', async () => {
    const http = request(app.getHttpServer());

    const session = await http.post('/v1/auth/session').send({ email: `turn_${Date.now()}@test.local` });
    const { token, userId: uid } = session.body.data as { token: string; userId: string };
    userId = uid;
    // Provision the user (first authenticated access).
    await http.get('/v1/me').set('authorization', `Bearer ${token}`).expect(200);

    const conv = await http
      .post('/v1/conversations')
      .set('authorization', `Bearer ${token}`)
      .send({ title: 'Groceries' })
      .expect(201);
    const conversationId = conv.body.data.id as string;

    const turn = await http
      .post(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ content: 'order coffee and milk' })
      .expect(201);
    expect(turn.body.data.status).toBe('completed');
    expect(turn.body.data.assistantMessage.content).toContain('order coffee and milk');

    const history = await http
      .get(`/v1/conversations/${conversationId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    // user + assistant messages persisted this turn.
    expect(history.body.data.data.length).toBe(2);
    expect(history.body.data.data.map((m: { role: string }) => m.role).sort()).toEqual([
      'assistant',
      'user',
    ]);
  });

  it('rejects an unauthenticated turn', async () => {
    await request(app.getHttpServer())
      .post('/v1/conversations/00000000-0000-0000-0000-000000000000/messages')
      .send({ content: 'hi' })
      .expect(401);
  });
});
