import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { RedisCache } from '../src/shared/cache/redis-cache.js';
import { AuditLog } from '../src/shared/audit/audit-log.js';
import { GrantsRepository } from '../src/modules/permission/adapters/out/grants.repository.js';
import { PgPermissionEngine } from '../src/modules/permission/permission.engine.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

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

describe('Phase 07 — permission engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let cache: RedisCache;
  let engine: PgPermissionEngine;
  const userId = randomUUID();

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    cache = new RedisCache(REDIS_URL);
    engine = new PgPermissionEngine(new GrantsRepository(db), cache, new AuditLog(db));

    // Seed: a user + a capability + grants (service context).
    await db.query("insert into platform.users (id, email) values ($1, $2)", [
      userId,
      `perm_${userId}@test.local`,
    ]);
    await db.query(
      "insert into catalog.capabilities (key, domain, description) values ('grocery.order','grocery','x'),('grocery.read','grocery','x') on conflict do nothing",
    );
  });

  afterAll(async () => {
    await db.query('delete from billing.capability_grants where user_id = $1', [userId]);
    await db.query('delete from platform.audit_logs where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    cache.onModuleDestroy();
    await db.close();
  });

  it('denies by default and writes an audit row', async () => {
    const decision = await engine.can(userId, 'grocery.order');
    expect(decision.allow).toBe(false);
    expect(decision.reason).toMatch(/missing capability/);
    const audit = await db.query(
      "select 1 from platform.audit_logs where user_id = $1 and action = 'permission.check' and decision = 'deny'",
      [userId],
    );
    expect(audit.rowCount).toBeGreaterThanOrEqual(1);
  });

  it('allows once a grant exists (after cache invalidation)', async () => {
    await db.query(
      "insert into billing.capability_grants (user_id, capability_key, source) values ($1,'grocery.order','subscription')",
      [userId],
    );
    await engine.invalidate(userId); // grant change invalidates the cached set
    const decision = await engine.can(userId, 'grocery.order');
    expect(decision.allow).toBe(true);
  });

  it('aggregates capabilities across multiple grant sources', async () => {
    await db.query(
      "insert into billing.capability_grants (user_id, capability_key, source) values ($1,'grocery.read','trial')",
      [userId],
    );
    await engine.invalidate(userId);
    const caps = await engine.capabilitiesFor(userId);
    expect(caps.sort()).toEqual(['grocery.order', 'grocery.read']);
  });

  it('ignores expired grants', async () => {
    const otherUser = randomUUID();
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      otherUser,
      `exp_${otherUser}@test.local`,
    ]);
    await db.query(
      "insert into billing.capability_grants (user_id, capability_key, source, expires_at) values ($1,'grocery.order','trial', now() - interval '1 hour')",
      [otherUser],
    );
    const decision = await engine.can(otherUser, 'grocery.order');
    expect(decision.allow).toBe(false);
    await db.query('delete from billing.capability_grants where user_id = $1', [otherUser]);
    await db.query('delete from platform.audit_logs where user_id = $1', [otherUser]);
    await db.query('delete from platform.users where id = $1', [otherUser]);
  });
});
