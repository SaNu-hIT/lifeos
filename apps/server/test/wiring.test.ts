import { describe, expect, it } from 'vitest';
import { buildManifests } from '../src/skills.js';
import { InMemoryGroceryRepository } from '../src/adapters/in-memory-grocery.repository.js';
import { addLine, emptyCart, type Product } from '@lifeos/skill-grocery';

describe('composition — buildManifests', () => {
  it('installs grocery + calendar with their tools', () => {
    const manifests = buildManifests(async () => {});
    expect(manifests.map((m) => m.key)).toEqual(['grocery', 'calendar']);
    const toolNames = manifests.flatMap((m) => m.tools.map((t) => t.name));
    expect(toolNames).toEqual(
      expect.arrayContaining([
        'grocery.search_products',
        'grocery.place_order',
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
