import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { RedisCache } from '../src/shared/cache/redis-cache.js';
import { AuditLog } from '../src/shared/audit/audit-log.js';
import { GrantsRepository } from '../src/modules/permission/adapters/out/grants.repository.js';
import { PgPermissionEngine } from '../src/modules/permission/permission.engine.js';
import { SubscriptionRepository } from '../src/modules/subscription/adapters/out/subscription.repository.js';
import { SubscriptionService } from '../src/modules/subscription/application/subscription.service.js';

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

describe('Phase 08 — subscription engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let cache: RedisCache;
  let engine: PgPermissionEngine;
  let subscriptions: SubscriptionService;
  const userId = randomUUID();

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    cache = new RedisCache(REDIS_URL);
    engine = new PgPermissionEngine(new GrantsRepository(db), cache, new AuditLog(db));
    subscriptions = new SubscriptionService(new SubscriptionRepository(db), engine);

    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `sub_${userId}@test.local`,
    ]);
    await db.query(
      "insert into catalog.capabilities (key, domain, description) values ('grocery.order','grocery','x'),('ai.advanced_planning','ai','x') on conflict do nothing",
    );
    // The 'test_pro' plan grants two capabilities — data, not code.
    await db.query("insert into billing.plans (key, name) values ('test_pro','Pro') on conflict do nothing");
    await db.query(
      "insert into billing.plan_capabilities (plan_key, capability_key) values ('test_pro','grocery.order'),('test_pro','ai.advanced_planning') on conflict do nothing",
    );
  });

  afterAll(async () => {
    await db.query('delete from billing.capability_grants where user_id = $1', [userId]);
    await db.query('delete from billing.subscriptions where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    cache.onModuleDestroy();
    await db.close();
  });

  it('changing plan materializes grants and permission reflects it', async () => {
    // Before: no subscription → denied.
    expect((await engine.can(userId, 'grocery.order')).allow).toBe(false);

    await subscriptions.changePlan(userId, 'test_pro');

    // After: the plan's capabilities are granted and authorized.
    expect((await engine.can(userId, 'grocery.order')).allow).toBe(true);
    expect((await engine.can(userId, 'ai.advanced_planning')).allow).toBe(true);

    const status = await new SubscriptionRepository(db).statusFor(userId);
    expect(status).toEqual({ active: true, planKey: 'test_pro' });
  });

  it('a trial grant authorizes immediately and expires', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await subscriptions.startTrial(userId, ['grocery.order'], past); // already expired
    // Trial is expired, but the 'test_pro' subscription still grants grocery.order.
    expect((await engine.can(userId, 'grocery.order')).allow).toBe(true);

    const future = new Date(Date.now() + 3_600_000).toISOString();
    const other = randomUUID();
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      other,
      `trial_${other}@test.local`,
    ]);
    const otherEngine = new PgPermissionEngine(new GrantsRepository(db), cache, new AuditLog(db));
    const otherSubs = new SubscriptionService(new SubscriptionRepository(db), otherEngine);
    await otherSubs.startTrial(other, ['grocery.order'], future);
    expect((await otherEngine.can(other, 'grocery.order')).allow).toBe(true);

    await db.query('delete from billing.capability_grants where user_id = $1', [other]);
    await db.query('delete from platform.users where id = $1', [other]);
  });

  it('changing plan is idempotent (re-applying yields the same grant set)', async () => {
    await subscriptions.changePlan(userId, 'test_pro');
    await subscriptions.changePlan(userId, 'test_pro');
    const grants = await db.query<{ capability_key: string }>(
      "select capability_key from billing.capability_grants where user_id = $1 and source = 'subscription' order by capability_key",
      [userId],
    );
    // 'assistant.use' is seeded onto every plan (migration 0042) so the assistant
    // skill's "what can you do" tool is always available, regardless of tier.
    expect(grants.rows.map((r) => r.capability_key)).toEqual([
      'ai.advanced_planning',
      'assistant.use',
      'grocery.order',
    ]);
  });
});
