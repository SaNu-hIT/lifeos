import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { currentVersion, runMigrations } from '../src/shared/database/migrate.js';

const TEST_DB_URL =
  process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

/** Ensure the target database exists (CI/local convenience). */
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

interface UserRow {
  id: string;
  email: string;
  locale: string;
  updated_at: string;
}

describe('Phase 04 — database foundation + RLS (integration)', () => {
  let db: PgDatabaseAdapter;
  const userA = randomUUID();
  const userB = randomUUID();
  const emailA = `a_${userA}@test.local`;
  const emailB = `b_${userB}@test.local`;

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    // Seed two users in SERVICE context (bypasses RLS — this is how provisioning works).
    await db.transaction(async (tx) => {
      await tx.query('insert into platform.users (id, email) values ($1, $2), ($3, $4)', [
        userA,
        emailA,
        userB,
        emailB,
      ]);
    });
  });

  afterAll(async () => {
    if (db) {
      await db.transaction(async (tx) => {
        await tx.query('delete from platform.users where id = any($1)', [[userA, userB]]);
        await tx.query('delete from platform.outbox where aggregate = $1', ['test']);
      });
      await db.close();
    }
  });

  it('has applied migrations (idempotent runner records a version)', async () => {
    const version = await currentVersion(TEST_DB_URL);
    expect(version).toMatch(/^\d{4}_/); // a numbered migration has been applied
  });

  it('RLS: a user in user-context sees ONLY their own row', async () => {
    const seenByA = await db.transaction(
      (tx) => tx.query<UserRow>('select email from platform.users'),
      { as: 'user', userId: userA },
    );
    expect(seenByA.rows.map((r) => r.email)).toEqual([emailA]);

    const seenByB = await db.transaction(
      (tx) => tx.query<UserRow>('select email from platform.users'),
      { as: 'user', userId: userB },
    );
    expect(seenByB.rows.map((r) => r.email)).toEqual([emailB]);
  });

  it('RLS: a user cannot update another user’s row (0 rows affected)', async () => {
    const result = await db.transaction(
      (tx) =>
        tx.query('update platform.users set locale = $1 where id = $2', ['hacked', userA]),
      { as: 'user', userId: userB },
    );
    expect(result.rowCount).toBe(0);

    // Confirm A's row is untouched (read in service context).
    const check = await db.query<UserRow>('select locale from platform.users where id = $1', [
      userA,
    ]);
    expect(check.rows[0]?.locale).not.toBe('hacked');
  });

  it('updated_at trigger bumps the timestamp on update', async () => {
    const before = await db.query<UserRow>('select updated_at from platform.users where id = $1', [
      userA,
    ]);
    await new Promise((r) => setTimeout(r, 10));
    await db.query('update platform.users set locale = $1 where id = $2', ['en-US', userA]);
    const after = await db.query<UserRow>('select updated_at from platform.users where id = $1', [
      userA,
    ]);
    expect(new Date(after.rows[0]!.updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0]!.updated_at).getTime(),
    );
  });

  it('outbox accepts appends and indexes unpublished rows', async () => {
    await db.transaction(async (tx) => {
      await tx.query(
        'insert into platform.outbox (aggregate, event_type, payload) values ($1, $2, $3)',
        ['test', 'test.event_happened', JSON.stringify({ ok: true })],
      );
    });
    const unpublished = await db.query<{ count: string }>(
      "select count(*)::text as count from platform.outbox where aggregate = 'test' and published_at is null",
    );
    expect(Number(unpublished.rows[0]!.count)).toBeGreaterThanOrEqual(1);
  });
});
