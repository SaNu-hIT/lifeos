import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CapabilityKey, PermissionDecision, PermissionPort } from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { WidgetInstanceRepository } from '../src/modules/home/adapters/out/widget-instance.repository.js';
import { HomeEngine } from '../src/modules/home/home.engine.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

/** Grants only the capabilities in the set; deny-by-default otherwise. */
class StubPermissions implements PermissionPort {
  constructor(private readonly granted: Set<string>) {}
  async can(_userId: string, capability: CapabilityKey): Promise<PermissionDecision> {
    return { allow: this.granted.has(capability) };
  }
  async capabilitiesFor(): Promise<CapabilityKey[]> {
    return [...this.granted] as CapabilityKey[];
  }
}

describe('Phase 21 — home widget engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let repo: WidgetInstanceRepository;
  const userId = randomUUID();

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    repo = new WidgetInstanceRepository(db);
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `home_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query('delete from surface.widget_instances where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  function engineWith(granted: string[]): HomeEngine {
    const engine = new HomeEngine(new StubPermissions(new Set(granted)), repo);
    engine.registerWidget({
      key: 'grocery.next_delivery',
      title: 'Next delivery',
      capability: 'grocery.view',
      priority: 10,
      build: async () => ({ urgency: 0.9, props: { eta: '18:00' } }),
    });
    engine.registerWidget({
      key: 'core.welcome',
      title: 'Welcome',
      priority: 50, // higher base priority, but no urgency
      build: async () => ({ props: { greeting: 'Hi' } }),
    });
    engine.registerWidget({
      key: 'core.broken',
      title: 'Broken',
      priority: 999,
      build: async () => {
        throw new Error('widget blew up');
      },
    });
    engine.registerWidget({
      key: 'core.empty',
      title: 'Empty',
      priority: 999,
      build: async () => null, // renders nothing this cycle
    });
    return engine;
  }

  it('hides a capability-gated widget when the capability is absent', async () => {
    const home = await engineWith([]).getHome(userId);
    const keys = home.widgets.map((w) => w.key);
    expect(keys).toContain('core.welcome');
    expect(keys).not.toContain('grocery.next_delivery'); // no grocery.view
  });

  it('drops widgets that build null or throw, and ranks by urgency-boosted priority', async () => {
    const home = await engineWith(['grocery.view']).getHome(userId);
    const keys = home.widgets.map((w) => w.key);
    expect(keys).not.toContain('core.broken'); // threw → dropped
    expect(keys).not.toContain('core.empty'); // null → dropped
    // grocery 10 + 0.9*100 = 100 > welcome 50 → grocery ranks first.
    expect(keys).toEqual(['grocery.next_delivery', 'core.welcome']);
  });

  it('honors user preferences: hidden removes, pinned floats to top (RLS-scoped)', async () => {
    await repo.upsert(userId, 'core.welcome', { pinned: true });
    await repo.upsert(userId, 'grocery.next_delivery', { hidden: true });

    const home = await engineWith(['grocery.view']).getHome(userId);
    const keys = home.widgets.map((w) => w.key);
    expect(keys).not.toContain('grocery.next_delivery'); // hidden
    expect(keys[0]).toBe('core.welcome'); // pinned → top
    expect(home.widgets[0]?.pinned).toBe(true);
  });
});
