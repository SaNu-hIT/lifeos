import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { Tool, UnifiedContext } from '@lifeos/contracts';
import {
  createGrocerySkill,
  emptyCart,
  type Cart,
  type CartLine,
  type GroceryProviderPort,
  type GroceryRepositoryPort,
  type Order,
  type Product,
} from '../src/index.js';

// ── Test doubles ────────────────────────────────────────────────────────────
class InMemoryRepo implements GroceryRepositoryPort {
  private carts = new Map<string, Cart>();
  readonly orders: Order[] = [];
  async getCart(userId: string): Promise<Cart> {
    return this.carts.get(userId) ?? emptyCart(userId);
  }
  async saveCart(cart: Cart): Promise<void> {
    this.carts.set(cart.userId, cart);
  }
  async clearCart(userId: string): Promise<void> {
    this.carts.delete(userId);
  }
  async saveOrder(order: Order): Promise<void> {
    this.orders.push(order);
  }
  async getOrder(userId: string, orderId: string): Promise<Order | undefined> {
    return this.orders.find((o) => o.userId === userId && o.id === orderId);
  }
  async recentOrders(userId: string, limit: number): Promise<Order[]> {
    return this.orders
      .filter((o) => o.userId === userId)
      .slice()
      .reverse()
      .slice(0, limit);
  }
}

const MILK: Product = { id: 'p1', name: 'Milk', priceMinor: 5000, unit: 'litre' };

class MockProvider implements GroceryProviderPort {
  readonly key = 'mock_grocery';
  readonly domain = 'grocery' as const;
  submitted: CartLine[] | null = null;
  async health() {
    return { healthy: true };
  }
  async searchProducts(query: string): Promise<Product[]> {
    return [MILK].filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }
  async submitOrder(_userId: string, lines: CartLine[]) {
    this.submitted = lines;
    return { providerOrderId: 'prov-123', etaMinutes: 15 };
  }
}

function ctxFor(userId: string): UnifiedContext {
  return {
    user: { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['grocery.read', 'grocery.order'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'grocery',
    now: '2026-07-01T12:00:00.000Z',
  };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

describe('@lifeos/skill-grocery', () => {
  function setup() {
    const repository = new InMemoryRepo();
    const provider = new MockProvider();
    let seq = 0;
    const published: Array<{ type: string }> = [];
    const skill = createGrocerySkill({
      repository,
      provider,
      newId: () => `id-${(seq += 1)}`,
      publish: async (event) => {
        published.push(event);
      },
    });
    return { repository, provider, skill, tools: skill.tools, published };
  }

  it('passes the skill contract kit', () => {
    const { skill } = setup();
    expect(() => runSkillContractTests(skill)).not.toThrow();
  });

  it('namespaces every tool and gates order placement behind confirmation + grocery.order', () => {
    const { tools } = setup();
    expect(tools.every((t) => t.name.startsWith('grocery.'))).toBe(true);
    const place = tool(tools, 'grocery.place_order');
    expect(place.requiresConfirmation).toBe(true);
    expect(place.requiredCapability).toBe('grocery.order');
    expect(tool(tools, 'grocery.search_products').requiredCapability).toBe('grocery.read');
  });

  it('runs search → build cart → confirm → place order end-to-end', async () => {
    const { tools, repository, provider, published } = setup();
    const ctx = ctxFor('u1');

    const found = (await tool(tools, 'grocery.search_products').handler(ctx, { query: 'milk' })) as {
      products: Product[];
    };
    expect(found.products[0]?.name).toBe('Milk');

    const built = (await tool(tools, 'grocery.build_cart').handler(ctx, {
      items: [{ ...MILK, quantity: 2 }],
    })) as { lineCount: number; totalMinor: number };
    expect(built).toEqual({ lineCount: 1, totalMinor: 10000 });

    const confirm = (await tool(tools, 'grocery.request_confirmation').handler(ctx, {})) as {
      summary: string;
      totalMinor: number;
    };
    expect(confirm.summary).toBe('2× Milk');
    expect(confirm.totalMinor).toBe(10000);

    const order = (await tool(tools, 'grocery.place_order').handler(ctx, {})) as {
      orderId: string;
      status: string;
      etaMinutes?: number;
    };
    expect(order).toEqual({ orderId: 'id-1', status: 'placed', etaMinutes: 15 });
    expect(provider.submitted).toHaveLength(1); // went through the provider port
    expect(repository.orders[0]?.totalMinor).toBe(10000);
    // Cart is cleared after a successful order.
    expect((await repository.getCart('u1')).lines).toHaveLength(0);
    // A grocery.order_placed event was published to drive the surfaces.
    expect(published.map((e) => e.type)).toEqual(['grocery.order_placed']);
  });

  it('refuses to place an order with an empty cart (domain invariant)', async () => {
    const { tools } = setup();
    await expect(tool(tools, 'grocery.place_order').handler(ctxFor('u2'), {})).rejects.toThrow(
      /empty cart/,
    );
  });
});
