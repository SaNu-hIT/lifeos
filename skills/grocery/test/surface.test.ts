import { describe, expect, it } from 'vitest';
import type { DomainEvent, WidgetContext } from '@lifeos/contracts';
import {
  GROCERY_ORDER_PLACED,
  createGroceryActivityProjection,
  createGroceryNotification,
  createGroceryWidgets,
  emptyCart,
  type Cart,
  type Order,
  type OrderPlacedPayload,
  type Product,
} from '../src/index.js';
import type { GroceryRepositoryPort } from '../src/ports/grocery-repository.port.js';

const MILK: Product = { id: 'p1', name: 'Milk', priceMinor: 5000, unit: 'litre' };

function orderPlaced(payload: OrderPlacedPayload): DomainEvent {
  return {
    eventId: 'e1',
    type: GROCERY_ORDER_PLACED,
    userId: 'u1',
    occurredAt: '2026-07-01T12:00:00.000Z',
    payload,
  };
}

class Repo implements GroceryRepositoryPort {
  constructor(private readonly ordersList: Order[]) {}
  async getCart(userId: string): Promise<Cart> {
    return emptyCart(userId);
  }
  async saveCart(): Promise<void> {}
  async clearCart(): Promise<void> {}
  async saveOrder(): Promise<void> {}
  async getOrder(): Promise<Order | undefined> {
    return undefined;
  }
  async recentOrders(_userId: string, limit: number): Promise<Order[]> {
    return this.ordersList.slice(0, limit);
  }
}

function order(id: string, at: string): Order {
  return {
    id,
    userId: 'u1',
    lines: [{ product: MILK, quantity: 1 }],
    totalMinor: 5000,
    status: 'placed',
    etaMinutes: 12,
    placedAt: at,
  };
}

describe('grocery — surface contributions', () => {
  const payload: OrderPlacedPayload = {
    orderId: 'o1',
    providerOrderId: 'blinkit-u1-1',
    itemCount: 2,
    totalMinor: 12500,
    etaMinutes: 9,
  };

  it('activity projection turns the order event into a feed entry', () => {
    const entry = createGroceryActivityProjection().build(orderPlaced(payload));
    expect(entry).toMatchObject({
      userId: 'u1',
      kind: GROCERY_ORDER_PLACED,
      title: 'Placed a grocery order',
      deepLink: '/grocery/orders/o1',
    });
    expect(entry?.summary).toContain('₹125.00');
  });

  it('notification declaration builds an in-app + push intent, deduped by order', () => {
    const intent = createGroceryNotification().build(orderPlaced(payload));
    expect(intent).toMatchObject({
      kind: GROCERY_ORDER_PLACED,
      channels: ['in_app', 'push'],
      dedupeKey: 'grocery.order.o1',
    });
    expect(intent?.body).toContain('~9 min');
  });

  it('reorder widget shows staples, and hides when there is no habit yet', async () => {
    const ctx: WidgetContext = { userId: 'u1' };
    const withHistory = createGroceryWidgets({
      repository: new Repo([order('o2', '2026-06-30T10:00:00Z'), order('o1', '2026-06-20T10:00:00Z')]),
    });
    const reorder = withHistory.find((w) => w.key === 'grocery.reorder')!;
    const data = await reorder.build(ctx);
    expect((data?.props.staples as unknown[]).length).toBe(1); // Milk ordered twice

    const empty = createGroceryWidgets({ repository: new Repo([]) });
    expect(await empty.find((w) => w.key === 'grocery.reorder')!.build(ctx)).toBeNull();
  });

  it('last-order widget reflects the most recent order', async () => {
    const widgets = createGroceryWidgets({ repository: new Repo([order('o9', '2026-06-30T10:00:00Z')]) });
    const data = await widgets.find((w) => w.key === 'grocery.last_order')!.build({ userId: 'u1' });
    expect(data?.props).toMatchObject({ orderId: 'o9', itemCount: 1, etaMinutes: 12 });
    expect(data?.asOf).toBe('2026-06-30T10:00:00Z');
  });
});
