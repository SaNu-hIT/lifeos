import { describe, expect, it } from 'vitest';
import type { ContextRequest } from '@lifeos/contracts';
import {
  addLine,
  cartTotalMinor,
  createGroceryContextProvider,
  deriveStaples,
  emptyCart,
  type Cart,
  type Order,
  type Product,
} from '../src/index.js';
import type { GroceryRepositoryPort } from '../src/ports/grocery-repository.port.js';

const MILK: Product = { id: 'p1', name: 'Milk', priceMinor: 5000, unit: 'litre' };
const BREAD: Product = { id: 'p2', name: 'Bread', priceMinor: 3000, unit: 'pack' };
const EGGS: Product = { id: 'p3', name: 'Eggs', priceMinor: 8000, unit: 'dozen' };

function order(id: string, at: string, ...products: Product[]): Order {
  const lines = products.map((product) => ({ product, quantity: 1 }));
  return {
    id,
    userId: 'u1',
    lines,
    totalMinor: lines.reduce((s, l) => s + l.product.priceMinor, 0),
    status: 'placed',
    placedAt: at,
  };
}

class SeededRepo implements GroceryRepositoryPort {
  constructor(
    private readonly cart: Cart,
    private readonly ordersList: Order[],
  ) {}
  async getCart(userId: string): Promise<Cart> {
    return this.cart.userId === userId ? this.cart : emptyCart(userId);
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

describe('grocery — personalization (deriveStaples)', () => {
  it('flags products ordered in >= 2 distinct orders, ranked by frequency', () => {
    const orders = [
      order('o3', '2026-06-30T10:00:00Z', MILK, BREAD),
      order('o2', '2026-06-20T10:00:00Z', MILK, EGGS),
      order('o1', '2026-06-10T10:00:00Z', MILK),
    ];
    const staples = deriveStaples(orders);
    expect(staples.map((s) => s.product.name)).toEqual(['Milk']); // only Milk hit 2+ orders
    expect(staples[0]?.orderCount).toBe(3);
  });

  it('counts a product once per order, not per line', () => {
    const doubled = order('o1', '2026-06-10T10:00:00Z', MILK);
    doubled.lines.push({ product: MILK, quantity: 5 }); // same product twice in one order
    const staples = deriveStaples([doubled, order('o2', '2026-06-11T10:00:00Z', MILK)]);
    expect(staples[0]?.orderCount).toBe(2); // two distinct orders, not three lines
  });
});

describe('grocery — context provider', () => {
  it('surfaces cart, order history and staples into the Unified Context', async () => {
    const cart = addLine(emptyCart('u1'), MILK, 2);
    const orders = [
      order('o2', '2026-06-30T10:00:00Z', MILK, BREAD),
      order('o1', '2026-06-20T10:00:00Z', MILK),
    ];
    const provider = createGroceryContextProvider({ repository: new SeededRepo(cart, orders) });
    const request: ContextRequest = { userId: 'u1', conversationId: 'c1', scope: 'grocery' };

    const partial = await provider.contribute(request);

    const grocery = (partial.settings as { grocery: Record<string, unknown> }).grocery;
    expect(grocery.cart).toEqual({ lineCount: 1, totalMinor: cartTotalMinor(cart) });
    expect(grocery.recentOrderCount).toBe(2);
    expect(grocery.lastOrderAt).toBe('2026-06-30T10:00:00Z');
    expect(grocery.staples).toEqual(['Milk']);

    // Staple surfaces as a scoped memory preference the Planner can read.
    expect(partial.memory?.preferences).toEqual([
      { key: 'grocery.staple.p1', value: { name: 'Milk', orderCount: 2 }, scope: 'grocery' },
    ]);
  });

  it('is scoped to grocery', () => {
    const provider = createGroceryContextProvider({ repository: new SeededRepo(emptyCart('u1'), []) });
    expect(provider.scope).toBe('grocery');
  });
});
