// Live end-to-end smoke test against a REAL Postgres, exercising the full stack:
// buildManifests → real tool handlers → real Pg* adapters → real SQL → RLS (the
// non-privileged lifeos_app role with auth.uid() bound), across all three new skills.
//
// Gated on LIVE_DB_URL so the normal `pnpm test` run (which has no database) skips it.
// Run with:
//   LIVE_DB_URL=postgres://localhost:5432/lifeos_dev pnpm --filter @lifeos/server test skills-live
//
// Requires migrations 0031–0041 to have been applied to that database.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import type {
  ConnectorRegistryPort,
  DomainEvent,
  ProviderPort,
  SelectionPolicy,
  Tool,
  UnifiedContext,
} from '@lifeos/contracts';
import type { DatabasePort, DbContext, Tx } from '@lifeos/api';
import { buildManifests } from '../src/skills.js';

const LIVE_DB_URL = process.env.LIVE_DB_URL;
const describeLive = LIVE_DB_URL ? describe : describe.skip;

/** Minimal DatabasePort over a pg Pool — a faithful copy of PgDatabaseAdapter's
 *  RLS context handling (set local role + bind auth.uid()) so user-context work is
 *  subject to Row-Level Security exactly as in production. */
class LivePgAdapter implements DatabasePort {
  constructor(private readonly pool: Pool) {}
  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const r = await this.pool.query(sql, params);
    return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
  }
  async transaction<T>(fn: (tx: Tx) => Promise<T>, context: DbContext = { as: 'service' }): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (context.as === 'user') {
        await client.query('set local role lifeos_app');
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [context.userId]);
      }
      const tx: Tx = {
        query: async (sql, params = []) => {
          const r = await client.query(sql, params as unknown[]);
          return { rows: r.rows as never[], rowCount: r.rowCount ?? 0 };
        },
      };
      const result = await fn(tx);
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}

class FakeConnectorRegistry implements ConnectorRegistryPort {
  private connectors: ProviderPort[] = [];
  register(c: ProviderPort): void {
    this.connectors.push(c);
  }
  list(domain?: string): ProviderPort[] {
    return domain ? this.connectors.filter((c) => c.domain === domain) : this.connectors;
  }
  async select<P extends ProviderPort = ProviderPort>(domain: string, policy?: SelectionPolicy): Promise<P> {
    const found = (policy?.preferred ? this.list(domain).find((c) => c.key === policy.preferred) : undefined) ??
      this.list(domain)[0];
    if (!found) throw new Error(`no connector for domain: ${domain}`);
    return found as P;
  }
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

// A fixed test user id so the run is repeatable (rows are cleared in beforeAll).
const USER_ID = '00000000-0000-4000-8000-00000000beef';

describeLive('live smoke — new skills against real Postgres', () => {
  let db: LivePgAdapter;
  let pool: Pool;
  let tools: Tool[];
  const events: DomainEvent[] = [];

  function ctx(): UnifiedContext {
    return {
      user: { id: USER_ID, locale: 'en-IN', timezone: 'Asia/Kolkata' },
      capabilities: ['finance.read', 'finance.track', 'meal.read', 'meal.track', 'habit.read', 'habit.track'],
      conversation: { id: 'c-live', recentTurns: [] },
      memory: { facts: [], preferences: [], summaries: [] },
      settings: {},
      scope: 'finance',
      now: new Date().toISOString(),
    };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: LIVE_DB_URL });
    db = new LivePgAdapter(pool);

    // Seed the test user (service context bypasses RLS as superuser) and clear any
    // rows from a prior run so assertions are deterministic.
    await pool.query(
      `insert into platform.users (id, email) values ($1, $2)
       on conflict (id) do nothing`,
      [USER_ID, `live-smoke-${USER_ID}@example.com`],
    );
    await pool.query('delete from finance.transactions where user_id = $1', [USER_ID]);
    await pool.query('delete from finance.recurring_payments where user_id = $1', [USER_ID]);
    await pool.query('delete from finance.budget_limits where user_id = $1', [USER_ID]);
    await pool.query('delete from meal_planning.planned_meals where user_id = $1', [USER_ID]);
    await pool.query('delete from meal_planning.nutrition_log where user_id = $1', [USER_ID]);
    await pool.query('delete from habit.check_ins where user_id = $1', [USER_ID]);
    await pool.query('delete from habit.habits where user_id = $1', [USER_ID]);

    const manifests = buildManifests(
      async (e) => {
        events.push(e);
      },
      { db, connectors: new FakeConnectorRegistry(), upgradeUrl: 'https://app.lifeos.example/upgrade' },
    );
    tools = manifests.flatMap((m) => m.tools);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('finance: logs money and computes net + over-budget through RLS', async () => {
    const c = ctx();
    await tool(tools, 'finance.set_budget').handler(c, { categoryName: 'Food', monthlyLimitMinor: 100000 });
    await tool(tools, 'finance.log_transaction').handler(c, {
      type: 'income',
      amountMinor: 5000000,
      categoryName: 'Salary',
    });
    await tool(tools, 'finance.log_transaction').handler(c, {
      type: 'expense',
      amountMinor: 150000,
      categoryName: 'Food',
    });

    const summary = (await tool(tools, 'finance.get_summary').handler(c, {})) as {
      totalIncomeMinor: number;
      totalExpenseMinor: number;
      netMinor: number;
      byCategory: { categoryName: string; overBudget: boolean }[];
    };
    expect(summary.totalIncomeMinor).toBe(5000000);
    expect(summary.totalExpenseMinor).toBe(150000);
    expect(summary.netMinor).toBe(4850000);
    expect(summary.byCategory.find((x) => x.categoryName === 'Food')!.overBudget).toBe(true);
    expect(events.some((e) => e.type === 'finance.budget_exceeded')).toBe(true);
  });

  it('habit: create + check in three days yields a 3-day streak through RLS', async () => {
    const c = ctx();
    const { habitId } = (await tool(tools, 'habit.create_habit').handler(c, {
      name: 'Meditate',
      frequency: 'daily',
    })) as { habitId: string };

    const today = new Date();
    for (let i = 2; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      await tool(tools, 'habit.check_in').handler(c, { habitId, date: d });
    }

    const summary = (await tool(tools, 'habit.get_summary').handler(c, {})) as {
      habits: { habit: { name: string }; streak: { currentStreak: number } }[];
    };
    const meditate = summary.habits.find((h) => h.habit.name === 'Meditate')!;
    expect(meditate.streak.currentStreak).toBe(3);
  });

  it('meal: plan + grocery list, and catalog macro lookup on log through RLS', async () => {
    const c = ctx();
    const todayIso = new Date().toISOString().slice(0, 10);

    await tool(tools, 'meal.plan_meal').handler(c, { date: todayIso, slot: 'dinner', foodName: 'Pasta', servings: 2 });
    await tool(tools, 'meal.plan_meal').handler(c, { date: todayIso, slot: 'lunch', foodName: 'pasta', servings: 1 });

    const grocery = (await tool(tools, 'meal.generate_grocery_list').handler(c, {})) as {
      items: { name: string; quantity: number }[];
    };
    expect(grocery.items.find((i) => i.name.toLowerCase() === 'pasta')!.quantity).toBe(3);

    // 'Pasta' is in the seeded food_catalog (0037) at 220 kcal/serving → 2 servings = 440.
    await tool(tools, 'meal.log_food').handler(c, { foodName: 'Pasta', servings: 2, slot: 'dinner' });
    const nutrition = (await tool(tools, 'meal.get_nutrition_summary').handler(c, {})) as {
      days: { date: string; totalCalories: number }[];
    };
    const today = nutrition.days.find((d) => d.date === todayIso)!;
    expect(today.totalCalories).toBe(440);
  });
});
