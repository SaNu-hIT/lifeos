// Live integration test for PgPlanCatalogAdapter against a REAL Postgres.
//
// Gated on LIVE_DB_URL so the normal `pnpm test` run (no database) skips it. Run with:
//   LIVE_DB_URL=postgres://localhost:5432/lifeos_dev pnpm --filter @lifeos/server test pg-plan-catalog
//
// Requires migration 0042 (assistant.use seed) to have been applied.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type { DatabasePort, Tx } from '@lifeos/api';
import { PgPlanCatalogAdapter } from '../src/adapters/pg-plan-catalog.adapter.js';

const LIVE_DB_URL = process.env.LIVE_DB_URL;
const describeLive = LIVE_DB_URL ? describe : describe.skip;

class LivePgAdapter implements DatabasePort {
  constructor(private readonly pool: Pool) {}
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const r = await this.pool.query(sql, params);
    return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
  }
  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return fn(this);
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}

describeLive('PgPlanCatalogAdapter (live)', () => {
  let pool: Pool;
  let db: DatabasePort;
  let adapter: PgPlanCatalogAdapter;
  const userId = randomUUID();
  const planKey = `test_plan_${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    pool = new Pool({ connectionString: LIVE_DB_URL });
    db = new LivePgAdapter(pool);
    adapter = new PgPlanCatalogAdapter(db);

    await pool.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `plan-catalog-${userId}@example.com`,
    ]);
    await pool.query("insert into billing.plans (key, name) values ($1, 'Test Plan')", [planKey]);
    await pool.query(
      "insert into billing.plan_capabilities (plan_key, capability_key) values ($1, 'grocery.order') on conflict do nothing",
      [planKey],
    );
    await pool.query(
      "insert into billing.subscriptions (user_id, plan_key, status) values ($1, $2, 'active')",
      [userId, planKey],
    );
  });

  afterAll(async () => {
    await pool.query('delete from billing.subscriptions where user_id = $1', [userId]);
    await pool.query('delete from billing.plan_capabilities where plan_key = $1', [planKey]);
    await pool.query('delete from billing.plans where key = $1', [planKey]);
    await pool.query('delete from platform.users where id = $1', [userId]);
    await pool.end();
  });

  it('currentPlan returns the active subscription plan key', async () => {
    expect(await adapter.currentPlan(userId)).toBe(planKey);
    expect(await adapter.currentPlan(randomUUID())).toBeUndefined();
  });

  it('plansGranting returns every plan (key + name) that grants a capability', async () => {
    const [result] = await adapter.plansGranting(['grocery.order']);
    expect(result.capabilityKey).toBe('grocery.order');
    expect(result.plans.some((p) => p.key === planKey)).toBe(true);
  });

  it('plansGranting returns an empty plans list for a capability no plan grants', async () => {
    const [result] = await adapter.plansGranting(['nonexistent.capability']);
    expect(result).toEqual({ capabilityKey: 'nonexistent.capability', plans: [] });
  });
});
