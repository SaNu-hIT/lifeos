import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import {
  type ConnectorRegistryPort,
  type ProviderPort,
  type SelectionPolicy,
  type Tool,
  type UnifiedContext,
} from '@lifeos/contracts';
import {
  createGrocerySkill,
  emptyCart,
  type CachedPrice,
  type Cart,
  type CartLine,
  type GroceryListRepositoryPort,
  type GroceryPreference,
  type GroceryPreferencePort,
  type GroceryPriceCachePort,
  type GroceryProviderPort,
  type GroceryRepositoryPort,
  type ListItem,
  type Order,
  type PriceMatrix,
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

class InMemoryListRepo implements GroceryListRepositoryPort {
  private items: ListItem[] = [];
  private seq = 0;
  async addItem(userId: string, item: { name: string; quantity: number; unit?: string }): Promise<ListItem> {
    this.seq += 1;
    const created: ListItem = { id: `li-${this.seq}`, userId, createdAt: '2026-07-01T12:00:00.000Z', ...item };
    this.items.push(created);
    return created;
  }
  async removeItem(userId: string, itemId: string): Promise<void> {
    this.items = this.items.filter((i) => !(i.userId === userId && i.id === itemId));
  }
  async listItems(userId: string): Promise<ListItem[]> {
    return this.items.filter((i) => i.userId === userId);
  }
}

class InMemoryPriceCache implements GroceryPriceCachePort {
  private entries = new Map<string, CachedPrice>();
  private key(storeKey: string, productQuery: string): string {
    return `${storeKey}::${productQuery}`;
  }
  async get(storeKey: string, productQuery: string): Promise<CachedPrice | undefined> {
    return this.entries.get(this.key(storeKey, productQuery));
  }
  async set(entry: CachedPrice): Promise<void> {
    this.entries.set(this.key(entry.storeKey, entry.productQuery), entry);
  }
}

class InMemoryPreferenceRepo implements GroceryPreferencePort {
  private entries = new Map<string, GroceryPreference>();
  private key(userId: string, productName: string): string {
    return `${userId}::${productName}`;
  }
  async get(userId: string, productName: string): Promise<GroceryPreference | undefined> {
    return this.entries.get(this.key(userId, productName));
  }
  async set(pref: GroceryPreference): Promise<void> {
    this.entries.set(this.key(pref.userId, pref.productName), pref);
  }
}

/** A minimal fake registry — good enough to exercise fan-out over grocery connectors. */
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
    const preferred = policy?.preferred ? candidates.find((c) => c.key === policy.preferred) : undefined;
    const found = preferred ?? candidates[0];
    if (!found) throw new Error(`no connector for domain: ${domain}`);
    return found as P;
  }
}

/** A second grocery connector, priced differently from MockProvider, for compare_prices tests. */
class SecondProvider implements GroceryProviderPort {
  readonly key = 'second_store';
  readonly domain = 'grocery' as const;
  constructor(private readonly catalog: Product[] = [{ ...MILK, id: 'p2', priceMinor: 4500 }]) {}
  async health() {
    return { healthy: true };
  }
  async searchProducts(query: string): Promise<Product[]> {
    return this.catalog.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }
  async submitOrder(): Promise<{ providerOrderId: string; etaMinutes: number }> {
    throw new Error('not used in these tests');
  }
}

/** Sells milk under a genuinely different name, so the two stores together produce
 *  two distinct brands for the same shopping-list item (ambiguity trigger). */
class BrandedProvider implements GroceryProviderPort {
  readonly key = 'branded_store';
  readonly domain = 'grocery' as const;
  constructor(private readonly catalog: Product[] = [{ id: 'p3', name: 'Amul Milk', priceMinor: 4800, unit: '500 ml' }]) {}
  async health() {
    return { healthy: true };
  }
  async searchProducts(query: string): Promise<Product[]> {
    return this.catalog.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  }
  async submitOrder(): Promise<{ providerOrderId: string; etaMinutes: number }> {
    throw new Error('not used in these tests');
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
  function setup(extraConnectors: GroceryProviderPort[] = []) {
    const repository = new InMemoryRepo();
    const provider = new MockProvider();
    const list = new InMemoryListRepo();
    const priceCache = new InMemoryPriceCache();
    const preferences = new InMemoryPreferenceRepo();
    const connectors = new FakeConnectorRegistry();
    connectors.register(provider);
    for (const c of extraConnectors) connectors.register(c);
    let seq = 0;
    const published: Array<{ type: string }> = [];
    const skill = createGrocerySkill({
      repository,
      provider,
      list,
      priceCache,
      preferences,
      connectors,
      newId: () => `id-${(seq += 1)}`,
      publish: async (event) => {
        published.push(event);
      },
    });
    return { repository, provider, list, priceCache, preferences, connectors, skill, tools: skill.tools, published };
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

  it('persists the shopping list independent of chat history', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u3');

    const added = (await tool(tools, 'grocery.add_to_list').handler(ctx, {
      name: 'milk',
      quantity: 2,
    })) as { item: ListItem };
    expect(added.item.name).toBe('milk');

    const listed = (await tool(tools, 'grocery.get_list').handler(ctx, {})) as { items: ListItem[] };
    expect(listed.items.map((i) => i.name)).toEqual(['milk']);

    await tool(tools, 'grocery.remove_from_list').handler(ctx, { itemId: added.item.id });
    const afterRemove = (await tool(tools, 'grocery.get_list').handler(ctx, {})) as { items: ListItem[] };
    expect(afterRemove.items).toHaveLength(0);
  });

  it('compares prices across every registered store and picks the cheapest', async () => {
    const second = new SecondProvider(); // sells Milk at 4500, cheaper than MockProvider's 5000
    const { tools } = setup([second]);
    const ctx = ctxFor('u4');

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      items: Array<{ query: string; results: unknown[]; cheapest?: { store: string; priceMinor: number } }>;
      totals: Array<{ store: string; totalMinor: number }>;
    };

    expect(compared.items).toHaveLength(1);
    expect(compared.items[0]?.results).toHaveLength(2); // both stores had a match
    expect(compared.items[0]?.cheapest).toMatchObject({ store: 'second_store', priceMinor: 4500 });
    expect(compared.totals.find((t) => t.store === 'second_store')?.totalMinor).toBe(4500);
  });

  it('falls back to the last cached price when a store fails at request time', async () => {
    const flaky: GroceryProviderPort = {
      key: 'flaky_store',
      domain: 'grocery',
      health: async () => ({ healthy: true }),
      searchProducts: async () => {
        throw new Error('site is down');
      },
      submitOrder: async () => ({ providerOrderId: 'n/a', etaMinutes: 0 }),
    };
    const { tools, priceCache } = setup([flaky]);
    const ctx = ctxFor('u5');
    await priceCache.set({
      storeKey: 'flaky_store',
      productQuery: 'milk',
      productName: 'Milk', // same brand as the live store, so this stays a fallback-price test, not a brand-ambiguity one
      priceMinor: 4200,
      unit: 'litre',
      scrapedAt: '2026-06-30T00:00:00.000Z',
    });

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      items: Array<{ results: Array<{ store: string; source: string; asOf?: string; priceMinor: number }> }>;
    };

    const flakyResult = compared.items[0]?.results.find((r) => r.store === 'flaky_store');
    expect(flakyResult).toEqual({
      store: 'flaky_store',
      productName: 'Milk',
      priceMinor: 4200,
      unit: 'litre',
      source: 'cache',
      asOf: '2026-06-30T00:00:00.000Z',
    });
  });

  it('falls back to cache when a live scrape returns EMPTY (not just when it throws)', async () => {
    // Cloudflare/selector misses make the live scraper "succeed" with zero cards — an
    // empty result must not silently drop a store that has a good cached price.
    const emptyStore: GroceryProviderPort = {
      key: 'empty_store',
      domain: 'grocery',
      health: async () => ({ healthy: true }),
      searchProducts: async () => [], // succeeds, but finds nothing
      submitOrder: async () => ({ providerOrderId: 'n/a', etaMinutes: 0 }),
    };
    const { tools, priceCache } = setup([emptyStore]);
    const ctx = ctxFor('u15');
    await priceCache.set({
      storeKey: 'empty_store',
      productQuery: 'milk',
      productName: 'Milk', // same brand as MockProvider → no brand clarification
      priceMinor: 5400,
      unit: 'litre',
      scrapedAt: '2026-06-29T00:00:00.000Z',
    });

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      items: Array<{ results: Array<{ store: string; source: string; priceMinor: number }> }>;
    };

    const cachedHit = compared.items[0]?.results.find((r) => r.store === 'empty_store');
    expect(cachedHit).toMatchObject({ source: 'cache', priceMinor: 5400 });
  });

  it('shows every store\'s own cheapest per item in the grid — different brands, no clarification', async () => {
    const branded = new BrandedProvider(); // "Amul Milk" @4800; MockProvider has "Milk" @5000
    const { tools } = setup([branded]);
    const ctx = ctxFor('u6');

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    // No pause/clarification — the comparison returns a full grid directly.
    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      matrix: PriceMatrix;
    };

    // Both stores appear side by side, each with its own product (no brand narrowing).
    expect(compared.matrix.products).toEqual(['milk']);
    expect(compared.matrix.stores.sort()).toEqual(['branded_store', 'mock_grocery']);
    expect(compared.matrix.cells['milk']?.mock_grocery?.priceMinor).toBe(5000);
    expect(compared.matrix.cells['milk']?.branded_store?.priceMinor).toBe(4800);
  });

  it('keeps showing all stores in the grid even with a saved preference', async () => {
    const branded = new BrandedProvider();
    const { tools, preferences } = setup([branded]);
    const ctx = ctxFor('u7');

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    await preferences.set({ userId: 'u7', productName: 'milk', preferredBrand: 'Amul Milk', preferredUnit: '500 ml' });

    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      items: Array<{ cheapest?: { store: string; priceMinor: number } }>;
      matrix: PriceMatrix;
    };

    // A saved preference no longer hides other stores — both columns still show.
    expect(compared.matrix.cells['milk']?.mock_grocery?.priceMinor).toBe(5000);
    expect(compared.matrix.cells['milk']?.branded_store?.priceMinor).toBe(4800);
    // cheapest is the best option across stores.
    expect(compared.items[0]?.cheapest).toMatchObject({ store: 'branded_store', priceMinor: 4800 });
  });

  // ── Self-aware follow-up buttons ──────────────────────────────────────────
  it('offers "Compare prices" after add_to_list, and never re-offers it after comparing', async () => {
    const second = new SecondProvider();
    const { tools } = setup([second]);
    const ctx = ctxFor('u9');

    // add_to_list is the only tool that offers the compare button.
    const addTool = tool(tools, 'grocery.add_to_list');
    expect(addTool.followUps?.map((f) => f.label)).toEqual(['Compare prices across stores']);

    await addTool.handler(ctx, { name: 'milk', quantity: 1 });
    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      savablePicks: number;
    };

    // compare_prices never emits a "Compare prices" button — so it can't reappear.
    const compareTool = tool(tools, 'grocery.compare_prices');
    const compareButtons = compareTool.followUpsFor?.(compared as never, ctx) ?? [];
    expect(compareButtons.map((b) => b.label)).not.toContain('Compare prices across stores');
  });

  it('shows the "save brands" button only while there is an unsaved pick', async () => {
    const second = new SecondProvider(); // single brand "Milk" in both stores → no clarification
    const { tools } = setup([second]);
    const ctx = ctxFor('u10');
    const compareTool = tool(tools, 'grocery.compare_prices');

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });

    // First comparison: nothing saved yet → the button is offered.
    const first = (await compareTool.handler(ctx, {})) as { savablePicks: number };
    expect(first.savablePicks).toBe(1);
    expect(compareTool.followUpsFor?.(first as never, ctx).map((b) => b.label)).toEqual([
      'Save these as my preferred brands',
    ]);

    // Persist the picks, then compare again: nothing new to save → button hidden.
    const saved = (await tool(tools, 'grocery.save_preferences').handler(ctx, {})) as {
      saved: number;
      items: Array<{ productName: string; preferredBrand: string }>;
    };
    expect(saved).toEqual({ saved: 1, items: [{ productName: 'milk', preferredBrand: 'Milk' }] });

    const second2 = (await compareTool.handler(ctx, {})) as { savablePicks: number };
    expect(second2.savablePicks).toBe(0);
    expect(compareTool.followUpsFor?.(second2 as never, ctx)).toEqual([]);
  });

  it('save_preferences persists the current pick for every list item, including single-brand ones', async () => {
    const second = new SecondProvider();
    const { tools, preferences } = setup([second]);
    const ctx = ctxFor('u11');

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    // Compare first so the price cache is populated — save reads that, not a live scrape.
    await tool(tools, 'grocery.compare_prices').handler(ctx, {});
    await tool(tools, 'grocery.save_preferences').handler(ctx, {});

    const pref = await preferences.get('u11', 'milk');
    expect(pref).toMatchObject({ preferredBrand: 'Milk', preferredUnit: 'litre' });
  });

  // ── Product info: rating / rating count / availability ───────────────────
  it('carries rating + availability into the matrix, and skips out-of-stock when picking cheapest', async () => {
    const cheapButOut: GroceryProviderPort = {
      key: 'cheap_oos',
      domain: 'grocery',
      health: async () => ({ healthy: true }),
      searchProducts: async () => [
        { id: 'x', name: 'Milk', priceMinor: 4000, unit: 'litre', rating: 4.1, ratingCount: 500, available: false },
      ],
      submitOrder: async () => ({ providerOrderId: 'n/a', etaMinutes: 0 }),
    };
    const pricierInStock: GroceryProviderPort = {
      key: 'pricier',
      domain: 'grocery',
      health: async () => ({ healthy: true }),
      searchProducts: async () => [
        { id: 'y', name: 'Milk', priceMinor: 4800, unit: 'litre', rating: 4.6, ratingCount: 1200, available: true },
      ],
      submitOrder: async () => ({ providerOrderId: 'n/a', etaMinutes: 0 }),
    };
    const { tools } = setup([cheapButOut, pricierInStock]); // + MockProvider "Milk" @5000
    const ctx = ctxFor('u12');

    await tool(tools, 'grocery.add_to_list').handler(ctx, { name: 'milk', quantity: 1 });
    const compared = (await tool(tools, 'grocery.compare_prices').handler(ctx, {})) as {
      items: Array<{ cheapest?: { store: string; priceMinor: number } }>;
      matrix: PriceMatrix;
    };

    // The 4000 option is out of stock, so the cheapest pick is the in-stock 4800 store.
    expect(compared.items[0]?.cheapest).toMatchObject({ store: 'pricier', priceMinor: 4800 });
    // …but the out-of-stock store still appears, flagged unavailable, with its rating.
    expect(compared.matrix.cells['milk']?.cheap_oos).toMatchObject({
      priceMinor: 4000,
      available: false,
      rating: 4.1,
      ratingCount: 500,
    });
    expect(compared.matrix.cells['milk']?.pricier).toMatchObject({ priceMinor: 4800, rating: 4.6, ratingCount: 1200 });
  });

  // ── Ad-hoc single-item price lookup (grocery.check_price) ────────────────
  it('checks one product live — honoring a named store, or every store when none is named', async () => {
    const blinkit: GroceryProviderPort = {
      key: 'blinkit_live',
      domain: 'grocery',
      health: async () => ({ healthy: true }),
      searchProducts: async (q) =>
        q.toLowerCase().includes('curd')
          ? [{ id: 'c1', name: 'Amul Curd', priceMinor: 3500, unit: '400 g', rating: 4.4, ratingCount: 800, available: true }]
          : [],
      submitOrder: async () => ({ providerOrderId: 'n/a', etaMinutes: 0 }),
    };
    const zepto: GroceryProviderPort = {
      key: 'zepto_live',
      domain: 'grocery',
      health: async () => ({ healthy: true }),
      searchProducts: async (q) =>
        q.toLowerCase().includes('curd')
          ? [{ id: 'c2', name: 'Milky Mist Curd', priceMinor: 3200, unit: '400 g', rating: 4.2, ratingCount: 410, available: true }]
          : [],
      submitOrder: async () => ({ providerOrderId: 'n/a', etaMinutes: 0 }),
    };
    const { tools } = setup([blinkit, zepto]); // MockProvider (returns nothing for curd) also registered
    const ctx = ctxFor('u13');

    // "curd in blinkit" → just Blinkit, with rating + price.
    const onlyBlinkit = (await tool(tools, 'grocery.check_price').handler(ctx, { product: 'curd', store: 'blinkit' })) as {
      results: Array<{ store: string; productName: string; priceMinor: number; rating?: number }>;
    };
    expect(onlyBlinkit.results.map((r) => r.store)).toEqual(['blinkit_live']);
    expect(onlyBlinkit.results[0]).toMatchObject({ productName: 'Amul Curd', priceMinor: 3500, rating: 4.4 });

    // "price of curd" (no store) → every store, cheapest picked.
    const everywhere = (await tool(tools, 'grocery.check_price').handler(ctx, { product: 'curd' })) as {
      results: Array<{ store: string }>;
      cheapest?: { store: string; priceMinor: number };
    };
    expect(everywhere.results.map((r) => r.store).sort()).toEqual(['blinkit_live', 'zepto_live']);
    expect(everywhere.cheapest).toMatchObject({ store: 'zepto_live', priceMinor: 3200 });
  });
});
