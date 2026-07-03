import { describe, expect, it } from 'vitest';
import type { ConnectorRegistryPort, ProviderPort, SelectionPolicy } from '@lifeos/contracts';
import type { DatabasePort } from '@lifeos/api';
import { buildManifests } from '../src/skills.js';
import { InMemoryGroceryRepository } from '../src/adapters/in-memory-grocery.repository.js';
import { addLine, emptyCart, type Product } from '@lifeos/skill-grocery';

/** Never actually queried in this test — buildManifests only needs a DatabasePort
 *  reference to construct the Postgres adapters, it doesn't call them at build time. */
const fakeDb: DatabasePort = {
  query: async () => ({ rows: [], rowCount: 0 }),
  transaction: async (fn) => fn({ query: async () => ({ rows: [], rowCount: 0 }) }),
  close: async () => undefined,
};

class FakeConnectorRegistry implements ConnectorRegistryPort {
  private connectors: ProviderPort[] = [];
  register(connector: ProviderPort): void {
    this.connectors.push(connector);
  }
  list(domain?: string): ProviderPort[] {
    return domain ? this.connectors.filter((c) => c.domain === domain) : this.connectors;
  }
  async select<P extends ProviderPort = ProviderPort>(domain: string, policy?: SelectionPolicy): Promise<P> {
    const candidates = this.list(domain);
    const found = (policy?.preferred ? candidates.find((c) => c.key === policy.preferred) : undefined) ?? candidates[0];
    if (!found) throw new Error(`no connector for domain: ${domain}`);
    return found as P;
  }
}

describe('composition — buildManifests', () => {
  it('installs grocery + calendar with their tools', () => {
    const manifests = buildManifests(async () => {}, { db: fakeDb, connectors: new FakeConnectorRegistry() });
    expect(manifests.map((m) => m.key)).toEqual(['grocery', 'calendar']);
    const toolNames = manifests.flatMap((m) => m.tools.map((t) => t.name));
    expect(toolNames).toEqual(
      expect.arrayContaining([
        'grocery.search_products',
        'grocery.place_order',
        'grocery.add_to_list',
        'grocery.get_list',
        'grocery.compare_prices',
        'calendar.schedule_event',
      ]),
    );
    // Each Skill contributes its surface (widgets/activity/notification).
    expect(manifests[0]!.widgets?.length).toBeGreaterThan(0);
    expect(manifests[0]!.activityProjections?.length).toBeGreaterThan(0);
  });
});

describe('composition — in-memory grocery repo', () => {
  const MILK: Product = { id: 'p1', name: 'Milk', priceMinor: 5000, unit: 'litre' };

  it('round-trips a cart and lists recent orders newest-first', async () => {
    const repo = new InMemoryGroceryRepository();
    await repo.saveCart(addLine(emptyCart('u1'), MILK, 2));
    expect((await repo.getCart('u1')).lines).toHaveLength(1);

    await repo.saveOrder({
      id: 'o1', userId: 'u1', lines: [{ product: MILK, quantity: 2 }],
      totalMinor: 10000, status: 'placed', placedAt: '2026-07-01T10:00:00Z',
    });
    await repo.saveOrder({
      id: 'o2', userId: 'u1', lines: [{ product: MILK, quantity: 1 }],
      totalMinor: 5000, status: 'placed', placedAt: '2026-07-02T10:00:00Z',
    });
    const recent = await repo.recentOrders('u1', 10);
    expect(recent.map((o) => o.id)).toEqual(['o2', 'o1']);
    await repo.clearCart('u1');
    expect((await repo.getCart('u1')).lines).toHaveLength(0);
  });
});
