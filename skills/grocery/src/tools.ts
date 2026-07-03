// The Grocery tools — the units the Planner can call (ADR-0004: AI holds no logic;
// all rules live here). Handlers close over injected ports, so the Skill is pure and
// testable with fakes. userId + timestamps come from the Unified Context (no hidden
// clocks/globals, docs/02 §8).

import { type ConnectorRegistryPort, type DomainEvent, type Tool, type UnifiedContext } from '@lifeos/contracts';
import type { Product } from './domain/types.js';
import { addLine, cartTotalMinor, isEmpty } from './domain/cart.js';
import type { GroceryProviderPort } from './ports/grocery-provider.port.js';
import type { GroceryRepositoryPort } from './ports/grocery-repository.port.js';
import type { GroceryListRepositoryPort, ListItem } from './ports/grocery-list.port.js';
import type { CachedPrice, GroceryPriceCachePort } from './ports/grocery-price-cache.port.js';
import type { GroceryPreferencePort } from './ports/grocery-preference.port.js';
import { GROCERY_ORDER_PLACED, type OrderPlacedPayload } from './surface.js';

export interface GroceryToolDeps {
  repository: GroceryRepositoryPort;
  provider: GroceryProviderPort;
  /** The user's persistent shopping list — ground truth, independent of chat history. */
  list: GroceryListRepositoryPort;
  /** Last-known-good prices per store, used to answer comparisons when a live scrape fails. */
  priceCache: GroceryPriceCachePort;
  /** The user's saved brand/pack-size choice per product, so grocery.compare_prices
   *  only asks a clarifying question the first time. */
  preferences: GroceryPreferencePort;
  /** All registered grocery connectors (Blinkit, Zepto, ...), for cross-store comparison. */
  connectors: ConnectorRegistryPort;
  /** Order-id factory, supplied by the composition root (deterministic in tests).
   *  Injected rather than imported so the Skill stays free of platform/runtime deps. */
  newId: () => string;
  /** Publishes a domain event to the platform outbox (injected; no-op if absent).
   *  Drives the surface contributions (activity/notification) in phase 26. */
  publish?: (event: DomainEvent) => Promise<void>;
  /** Per-connector scrape timeout for grocery.compare_prices (ms). Defaults to 8000. */
  compareTimeoutMs?: number;
}

const PRODUCT_PROPS = {
  id: { type: 'string' },
  name: { type: 'string' },
  priceMinor: { type: 'integer' },
  unit: { type: 'string' },
} as const;

interface SearchArgs {
  query: string;
}
interface CheckPriceArgs {
  /** Product name to price, e.g. "curd". */
  product: string;
  /** Optional store to scope to, e.g. "blinkit"; omit to check every store. */
  store?: string;
}
interface CompareArgs {
  /** Answers to a prior clarification, keyed by shopping-list item name. */
  selections?: Record<string, { brand: string; unit?: string }>;
}
interface BuildCartArgs {
  items: Array<Product & { quantity: number }>;
}

export function createGroceryTools(deps: GroceryToolDeps): Tool[] {
  const { newId } = deps;

  const searchProducts: Tool<SearchArgs, { products: Product[] }> = {
    name: 'grocery.search_products',
    description:
      'Search ONE default store\'s live catalog for a single product, to add it to the cart for ' +
      'checkout. Does NOT compare across stores. For a one-off "what\'s the price of X" question ' +
      '(optionally at a named store) use grocery.check_price; to price the user\'s whole shopping ' +
      'list across every store use grocery.compare_prices.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: { products: { type: 'array' } },
      required: ['products'],
    },
    requiredCapability: 'grocery.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_ctx: UnifiedContext, args: SearchArgs) => {
      // Search a live store from the registry rather than the simulated checkout
      // catalog; fall back to the injected provider when no connector is registered.
      const store = (deps.connectors.list('grocery') as GroceryProviderPort[])[0] ?? deps.provider;
      return { products: await store.searchProducts(args.query) };
    },
  };

  const checkPrice: Tool<
    CheckPriceArgs,
    { query: string; results: StorePrice[]; cheapest?: StorePrice; matrix: PriceMatrix }
  > = {
    name: 'grocery.check_price',
    description:
      'Look up the current price of a SINGLE product by name, live, optionally at one named ' +
      'store — this is the tool for one-off questions like "price of curd", "how much is curd on ' +
      'blinkit", "curd price in zepto". Pass the product in `product` and, if the user named a ' +
      'store, its name in `store` (e.g. "blinkit", "zepto") to get just that store; omit `store` ' +
      'to check every store. Reports price, rating, and availability. Unlike ' +
      'grocery.compare_prices it does NOT use the shopping list (works for any item); unlike ' +
      'grocery.search_products it checks all/named live stores, not just the default checkout catalog.',
    inputSchema: {
      type: 'object',
      properties: { product: { type: 'string' }, store: { type: 'string' } },
      required: ['product'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        results: { type: 'array' },
        cheapest: { type: 'object' },
        matrix: { type: 'object' },
      },
      required: ['query', 'results', 'matrix'],
    },
    requiredCapability: 'grocery.read',
    idempotent: true,
    requiresConfirmation: false,
    // After a one-off price check, offer to remember the item on the shopping list.
    followUpsFor: (out) => [{ label: `Add ${out.query} to my list`, prompt: `add ${out.query} to my grocery list` }],
    handler: async (_ctx: UnifiedContext, args: CheckPriceArgs) => {
      const allStores = deps.connectors.list('grocery') as GroceryProviderPort[];
      // Honor a named store when it matches a registered connector (e.g. "blinkit" →
      // blinkit_live); if it names nothing we know, fall back to checking every store.
      const named = args.store?.trim().toLowerCase();
      const matched = named ? allStores.filter((s) => s.key.toLowerCase().includes(named)) : [];
      const stores = matched.length > 0 ? matched : allStores;
      const result = await compareOneItem({ name: args.product }, stores, deps.priceCache, compareTimeoutMs);
      return {
        query: args.product,
        results: result.results,
        ...(result.cheapest ? { cheapest: result.cheapest } : {}),
        matrix: buildPriceMatrix([result], stores.map((s) => s.key)),
      };
    },
  };

  const buildCart: Tool<BuildCartArgs, { lineCount: number; totalMinor: number }> = {
    name: 'grocery.build_cart',
    description: 'Add specific products (with a known id/price from a prior search) to the checkout cart.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { ...PRODUCT_PROPS, quantity: { type: 'integer' } },
            required: ['id', 'name', 'priceMinor', 'unit', 'quantity'],
          },
        },
      },
      required: ['items'],
    },
    outputSchema: {
      type: 'object',
      properties: { lineCount: { type: 'integer' }, totalMinor: { type: 'integer' } },
      required: ['lineCount', 'totalMinor'],
    },
    requiredCapability: 'grocery.read',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: BuildCartArgs) => {
      let cart = await deps.repository.getCart(ctx.user.id);
      for (const item of args.items) {
        const { quantity, ...product } = item;
        cart = addLine(cart, product, quantity);
      }
      await deps.repository.saveCart(cart);
      return { lineCount: cart.lines.length, totalMinor: cartTotalMinor(cart) };
    },
  };

  const requestConfirmation: Tool<Record<string, never>, { summary: string; totalMinor: number }> = {
    name: 'grocery.request_confirmation',
    description: 'Summarize the current checkout cart (items + total) for the user to confirm before ordering.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { summary: { type: 'string' }, totalMinor: { type: 'integer' } },
      required: ['summary', 'totalMinor'],
    },
    requiredCapability: 'grocery.order',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const cart = await deps.repository.getCart(ctx.user.id);
      const total = cartTotalMinor(cart);
      const summary = cart.lines
        .map((l) => `${l.quantity}× ${l.product.name}`)
        .join(', ');
      return { summary: summary || '(empty cart)', totalMinor: total };
    },
  };

  const placeOrder: Tool<Record<string, never>, { orderId: string; status: string; etaMinutes?: number }> = {
    name: 'grocery.place_order',
    description: 'Place a real order for everything currently in the checkout cart. Irreversible — requires confirmation.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        status: { type: 'string' },
        etaMinutes: { type: 'integer' },
      },
      required: ['orderId', 'status'],
    },
    requiredCapability: 'grocery.order',
    idempotent: false,
    requiresConfirmation: true, // irreversible: the platform gates on user confirmation
    handler: async (ctx: UnifiedContext) => {
      const cart = await deps.repository.getCart(ctx.user.id);
      if (isEmpty(cart)) throw new Error('cannot place an order with an empty cart');

      const submitted = await deps.provider.submitOrder(ctx.user.id, cart.lines);
      const order = {
        id: newId(),
        userId: ctx.user.id,
        lines: cart.lines,
        totalMinor: cartTotalMinor(cart),
        status: 'placed' as const,
        providerOrderId: submitted.providerOrderId,
        etaMinutes: submitted.etaMinutes,
        placedAt: ctx.now,
      };
      await deps.repository.saveOrder(order);
      await deps.repository.clearCart(ctx.user.id);

      // Announce the order so the surface engines react (activity/notification).
      if (deps.publish) {
        const payload: OrderPlacedPayload = {
          orderId: order.id,
          providerOrderId: order.providerOrderId,
          itemCount: order.lines.length,
          totalMinor: order.totalMinor,
          etaMinutes: order.etaMinutes,
        };
        await deps.publish({
          eventId: newId(),
          type: GROCERY_ORDER_PLACED,
          userId: ctx.user.id,
          occurredAt: ctx.now,
          payload,
        });
      }
      return { orderId: order.id, status: order.status, etaMinutes: order.etaMinutes };
    },
  };

  const compareTimeoutMs = deps.compareTimeoutMs ?? 8000;

  const addToList: Tool<{ name: string; quantity?: number; unit?: string }, { item: ListItem }> = {
    name: 'grocery.add_to_list',
    description:
      'Add an item to the user\'s persistent shopping list (separate from the checkout cart). ' +
      'Use this whenever the user says they want to buy/need something, or gives you a list of ' +
      'groceries, so it is remembered for later (e.g. for grocery.compare_prices).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        quantity: { type: 'integer' },
        unit: { type: 'string' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: { item: { type: 'object' } },
      required: ['item'],
    },
    requiredCapability: 'grocery.read',
    idempotent: false,
    requiresConfirmation: false,
    // After adding something to the list, offer the natural next step in one tap.
    followUps: [
      {
        label: 'Compare prices across stores',
        prompt: 'compare the prices of my grocery list across stores',
      },
    ],
    handler: async (ctx: UnifiedContext, args) => ({
      item: await deps.list.addItem(ctx.user.id, {
        name: args.name,
        quantity: args.quantity ?? 1,
        unit: args.unit,
      }),
    }),
  };

  const removeFromList: Tool<{ itemId: string }, { removed: boolean }> = {
    name: 'grocery.remove_from_list',
    description: 'Remove an item (by its id, from grocery.get_list) from the user\'s persistent shopping list.',
    inputSchema: {
      type: 'object',
      properties: { itemId: { type: 'string' } },
      required: ['itemId'],
    },
    outputSchema: {
      type: 'object',
      properties: { removed: { type: 'boolean' } },
      required: ['removed'],
    },
    requiredCapability: 'grocery.read',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args) => {
      await deps.list.removeItem(ctx.user.id, args.itemId);
      return { removed: true };
    },
  };

  const getList: Tool<Record<string, never>, { items: ListItem[] }> = {
    name: 'grocery.get_list',
    description: 'Read back the user\'s persistent shopping list exactly as stored (no store lookup or pricing).',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { items: { type: 'array' } },
      required: ['items'],
    },
    requiredCapability: 'grocery.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => ({ items: await deps.list.listItems(ctx.user.id) }),
  };

  const comparePrices: Tool<
    CompareArgs,
    { items: CompareItemResult[]; totals: StoreTotal[]; matrix: PriceMatrix; savablePicks: number }
  > = {
    name: 'grocery.compare_prices',
    description:
      'Check every item on the user\'s persistent shopping list against EVERY registered store ' +
      '(Blinkit, Zepto, and any others) and report the cheapest option per item and overall. This ' +
      'is the tool for "check/find/compare my groceries across stores" — it is NOT limited to one ' +
      'named store and does NOT take a store name as input; it always checks all of them and ' +
      'summarizes the result. If a product has multiple brands/pack sizes and the user has no ' +
      'saved preference, this pauses and asks the user to pick — pass their answers back in ' +
      '`selections` (productName -> {brand, unit}) to resume.',
    inputSchema: {
      type: 'object',
      properties: {
        selections: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: { brand: { type: 'string' }, unit: { type: 'string' } },
            required: ['brand'],
          },
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: { type: 'array' },
        totals: { type: 'array' },
        matrix: { type: 'object' },
        savablePicks: { type: 'integer' },
      },
      required: ['items', 'totals', 'matrix', 'savablePicks'],
    },
    requiredCapability: 'grocery.read',
    idempotent: true,
    requiresConfirmation: false,
    // Offer "save my brands" only when there's actually an unsaved pick — a self-aware
    // button that stays hidden once every item already has a matching saved preference.
    followUpsFor: (out) =>
      out.savablePicks > 0
        ? [{ label: 'Save these as my preferred brands', prompt: 'save my preferred brands from this comparison' }]
        : [],
    handler: async (ctx: UnifiedContext) => {
      // Dedupe by product name (case-insensitive) — the list can carry more than one row
      // for the same item (e.g. re-added across turns).
      const listItems = dedupeByName(await deps.list.listItems(ctx.user.id));
      const stores = deps.connectors.list('grocery') as GroceryProviderPort[];
      // Full cross-store grid: EVERY store's own cheapest match per item, shown side by side
      // (no brand narrowing) — a store that stocks the item always appears in its column,
      // even when stores carry different brands. cheapest = the best in-stock option overall.
      const results = await Promise.all(
        listItems.map((item) => compareOneItem(item, stores, deps.priceCache, compareTimeoutMs)),
      );

      // The self-aware "save my brands" button appears when an item's cheapest brand isn't
      // yet stored as a preference.
      const storedPrefs = await Promise.all(
        results.map((r) => deps.preferences.get(ctx.user.id, r.query)),
      );
      let savablePicks = 0;
      results.forEach((r, i) => {
        const brand = r.cheapest?.productName;
        if (brand && storedPrefs[i]?.preferredBrand !== brand) savablePicks += 1;
      });

      return {
        items: results,
        totals: sumByStore(results),
        matrix: buildPriceMatrix(results, stores.map((s) => s.key)),
        savablePicks,
      };
    },
  };

  const savePreferences: Tool<
    Record<string, never>,
    { saved: number; items: Array<{ productName: string; preferredBrand: string }> }
  > = {
    name: 'grocery.save_preferences',
    description:
      'Save the user\'s current brand pick for EVERY item on their shopping list as a preference, ' +
      'so future price comparisons skip the brand questions. For each item it keeps the brand the ' +
      'user already prefers (if still stocked) or otherwise the cheapest brand found right now — ' +
      'including single-brand items that never needed a clarification. Use this when the user asks ' +
      'to save/remember their brands or preferences after comparing prices.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: {
      type: 'object',
      properties: { saved: { type: 'integer' }, items: { type: 'array' } },
      required: ['saved', 'items'],
    },
    requiredCapability: 'grocery.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const listItems = dedupeByName(await deps.list.listItems(ctx.user.id));
      const stores = deps.connectors.list('grocery') as GroceryProviderPort[];
      const picks = await resolvePicks(listItems, stores, deps.priceCache, deps.preferences, ctx.user.id);
      for (const p of picks) {
        await deps.preferences.set({
          userId: ctx.user.id,
          productName: p.productName,
          preferredBrand: p.brandToSave,
          preferredUnit: p.unit,
        });
      }
      return {
        saved: picks.length,
        items: picks.map((p) => ({ productName: p.productName, preferredBrand: p.brandToSave })),
      };
    },
  };

  return [
    searchProducts,
    checkPrice,
    buildCart,
    requestConfirmation,
    placeOrder,
    addToList,
    removeFromList,
    getList,
    comparePrices,
    savePreferences,
  ];
}

/** Dedupe list rows by product name (case-insensitive) — the list can carry more than
 *  one row for the same item (e.g. re-added across turns); pricing/saving each row
 *  separately would repeat the same product. */
function dedupeByName(items: ListItem[]): ListItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One list item's brand to persist as a preference, and whether it's already saved. */
interface ResolvedPick {
  productName: string;
  brandToSave: string;
  unit?: string;
  alreadySaved: boolean;
}

/** Resolves, per list item, which brand to remember: the user's saved preference if it
 *  has one, otherwise the cheapest brand from the LAST comparison. Reads the price cache
 *  the comparison just populated instead of re-scraping — saving is instant and matches
 *  exactly what the user saw, rather than triggering a second live cross-store scrape.
 *  Items with no cached price (never compared) are skipped. */
async function resolvePicks(
  listItems: ListItem[],
  stores: GroceryProviderPort[],
  cache: GroceryPriceCachePort,
  prefs: GroceryPreferencePort,
  userId: string,
): Promise<ResolvedPick[]> {
  const picks: ResolvedPick[] = [];
  for (const item of listItems) {
    const cached = (
      await Promise.all(stores.map((s) => cache.get(s.key, item.name)))
    ).filter((c): c is CachedPrice => c !== undefined);
    if (cached.length === 0) continue; // never compared — nothing to remember
    // Prefer an in-stock brand when locking in the pick, mirroring the comparison.
    const cheapest = cheapestPreferAvailable(cached) ?? cached[0]!;
    const pref = await prefs.get(userId, item.name);
    // Keep an explicit preference as-is; otherwise lock in the cheapest brand seen.
    const brandToSave = pref?.preferredBrand ?? cheapest.productName;
    const match = cached.find((c) => c.productName === brandToSave);
    picks.push({
      productName: item.name,
      brandToSave,
      unit: match?.unit ?? pref?.preferredUnit,
      alreadySaved: pref?.preferredBrand === brandToSave,
    });
  }
  return picks;
}

export interface StorePrice {
  store: string;
  productName: string;
  priceMinor: number;
  unit: string;
  source: 'live' | 'cache';
  asOf?: string;
  /** Average star rating for this product at this store, if exposed. */
  rating?: number;
  /** How many ratings the average is based on. */
  ratingCount?: number;
  /** In stock at this store (undefined = the store didn't say → treated available). */
  available?: boolean;
  // ── Rich product info (from JSON-API connectors; all optional) ──
  brand?: string;
  size?: string;
  mrpMinor?: number;
  discountMinor?: number;
  deliveryEtaMinutes?: number;
  imageUrl?: string;
  productUrl?: string;
  stockStatus?: 'in_stock' | 'limited' | 'out_of_stock';
}

/** The optional rich product fields shared by Product / StorePrice / CachedPrice / PriceCell —
 *  extracted once so the mapping between them stays in one place. */
export interface RichProductInfo {
  rating?: number;
  ratingCount?: number;
  available?: boolean;
  brand?: string;
  size?: string;
  mrpMinor?: number;
  discountMinor?: number;
  deliveryEtaMinutes?: number;
  imageUrl?: string;
  productUrl?: string;
  stockStatus?: 'in_stock' | 'limited' | 'out_of_stock';
}

/** Pulls just the rich fields off any product-shaped source (Product, CachedPrice, StorePrice). */
function richOf(src: RichProductInfo): RichProductInfo {
  return {
    rating: src.rating,
    ratingCount: src.ratingCount,
    available: src.available ?? availableFromStatus(src.stockStatus),
    brand: src.brand,
    size: src.size,
    mrpMinor: src.mrpMinor,
    discountMinor: src.discountMinor,
    deliveryEtaMinutes: src.deliveryEtaMinutes,
    imageUrl: src.imageUrl,
    productUrl: src.productUrl,
    stockStatus: src.stockStatus,
  };
}

/** Derive the coarse `available` boolean from a `stockStatus` enum, when that's all we have. */
function availableFromStatus(status?: 'in_stock' | 'limited' | 'out_of_stock'): boolean | undefined {
  if (status === undefined) return undefined;
  return status !== 'out_of_stock';
}

export interface CompareItemResult {
  query: string;
  results: StorePrice[];
  cheapest?: StorePrice;
}

export interface StoreTotal {
  store: string;
  totalMinor: number;
  itemsCovered: number;
}

export interface ClarificationOption {
  brand: string;
  unit: string;
  priceMinor: number;
  storeKey: string;
}

/** One ambiguous shopping-list item and the brand/pack options found across stores —
 *  batched into one clarification per turn, not one question per item. */
export interface ClarificationChoice {
  productName: string;
  options: ClarificationOption[];
}

/** One product×store cell: the price plus the extra product info scraped alongside it
 *  (rating, stock, brand, MRP, discount, ETA, image, URL). `null` cell = store had no match. */
export interface PriceCell {
  priceMinor: number;
  rating?: number;
  ratingCount?: number;
  available?: boolean;
  brand?: string;
  size?: string;
  mrpMinor?: number;
  discountMinor?: number;
  deliveryEtaMinutes?: number;
  imageUrl?: string;
  productUrl?: string;
  stockStatus?: 'in_stock' | 'limited' | 'out_of_stock';
}

/** Rows = products, columns = stores, cells = price + product info, plus a totals
 *  row — the structured shape behind the price-comparison summary. */
export interface PriceMatrix {
  products: string[];
  stores: string[];
  cells: Record<string, Record<string, PriceCell | null>>;
  totalsByStore: Record<string, number>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * Queries every store for one list item, in parallel, with a per-store timeout. A
 * store that fails or times out falls back to its last cached price instead of
 * being dropped from the comparison — this is what keeps compare_prices answering
 * "any time" even when a live scrape is flaky (reliability requirement).
 */
async function compareOneItem(
  item: { name: string },
  stores: GroceryProviderPort[],
  cache: GroceryPriceCachePort,
  timeoutMs: number,
): Promise<CompareItemResult> {
  // Fall back to the last cached price. Guarded so a cache outage drops this store from
  // the comparison rather than crashing the whole tool.
  const fromCache = async (store: GroceryProviderPort): Promise<StorePrice | undefined> => {
    try {
      const cached = await cache.get(store.key, item.name);
      if (!cached) return undefined;
      return {
        store: cached.storeKey,
        productName: cached.productName,
        priceMinor: cached.priceMinor,
        unit: cached.unit,
        source: 'cache',
        asOf: cached.scrapedAt,
        ...richOf(cached),
      };
    } catch {
      return undefined;
    }
  };

  const results = await Promise.all(
    stores.map(async (store): Promise<StorePrice | undefined> => {
      try {
        const products = await withTimeout(store.searchProducts(item.name), timeoutMs);
        const best = cheapestProduct(products);
        // An empty live result (e.g. a Cloudflare page with no product cards, or a
        // selector miss) is unreliable, NOT proof the item is gone — prefer the last
        // cached price over dropping the store, same as an outright scrape failure.
        if (!best) return await fromCache(store);
        const entry: CachedPrice = {
          storeKey: store.key,
          productQuery: item.name,
          productName: best.name,
          priceMinor: best.priceMinor,
          unit: best.unit,
          scrapedAt: new Date().toISOString(),
          ...richOf(best),
        };
        // Best-effort cache write — a cache failure must not discard a good live result.
        try {
          await cache.set(entry);
        } catch {
          /* ignore cache write errors */
        }
        return {
          store: store.key,
          productName: best.name,
          priceMinor: best.priceMinor,
          unit: best.unit,
          source: 'live',
          ...richOf(best),
        };
      } catch {
        return await fromCache(store);
      }
    }),
  );
  const found = results.filter((r): r is StorePrice => r !== undefined);
  return { query: item.name, results: found, cheapest: cheapestOf(found) };
}

/** A missing `available` means the store didn't say — treat it as in stock. */
function inStock(item: { available?: boolean }): boolean {
  return item.available !== false;
}

/** Cheapest of a list, preferring in-stock items: picks the cheapest available one and
 *  only falls back to an out-of-stock item when nothing is in stock — so an out-of-stock
 *  store still appears in the comparison (marked unavailable) but never wins the "cheapest"
 *  pick over a store that can actually deliver it. */
function cheapestPreferAvailable<T extends { priceMinor: number; available?: boolean }>(
  items: T[],
): T | undefined {
  const cheapest = (list: T[]): T | undefined =>
    list.reduce<T | undefined>((min, p) => (!min || p.priceMinor < min.priceMinor ? p : min), undefined);
  const available = items.filter(inStock);
  return cheapest(available.length > 0 ? available : items);
}

function cheapestProduct(products: Product[]): Product | undefined {
  return cheapestPreferAvailable(products);
}

function cheapestOf(results: StorePrice[]): StorePrice | undefined {
  return cheapestPreferAvailable(results);
}

function sumByStore(items: CompareItemResult[]): StoreTotal[] {
  const totals = new Map<string, StoreTotal>();
  for (const item of items) {
    for (const r of item.results) {
      const t = totals.get(r.store) ?? { store: r.store, totalMinor: 0, itemsCovered: 0 };
      t.totalMinor += r.priceMinor;
      t.itemsCovered += 1;
      totals.set(r.store, t);
    }
  }
  return [...totals.values()].sort((a, b) => a.totalMinor - b.totalMinor);
}

/** Builds the products×stores comparison table: one row per shopping-list item, one
 *  column per EVERY queried store (not just ones with a surviving match, so a store
 *  that didn't stock the chosen brand still shows up as a blank cell), and a totals
 *  row summing only the items each store actually covered. */
function buildPriceMatrix(items: CompareItemResult[], storeKeys: string[]): PriceMatrix {
  const stores = [...new Set(storeKeys)].sort();
  const products = items.map((i) => i.query);
  const cells: Record<string, Record<string, PriceCell | null>> = {};
  const totalsByStore: Record<string, number> = Object.fromEntries(stores.map((s) => [s, 0]));

  for (const item of items) {
    const row: Record<string, PriceCell | null> = {};
    for (const store of stores) {
      const match = item.results.find((r) => r.store === store);
      row[store] = match ? { priceMinor: match.priceMinor, ...richOf(match) } : null;
      if (match) totalsByStore[store] = (totalsByStore[store] ?? 0) + match.priceMinor;
    }
    cells[item.query] = row;
  }

  return { products, stores, cells, totalsByStore };
}
