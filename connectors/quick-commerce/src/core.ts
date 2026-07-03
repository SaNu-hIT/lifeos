// Shared framework for the reverse-engineered JSON-API grocery connectors.
//
// Each platform (Blinkit, Zepto, Instamart, BigBasket, JioMart, Flipkart Minutes) supplies
// a config + a request builder + a parser; this module turns that into a GroceryProviderPort
// that our Skill/Registry/compare tools already know how to fan out over. Read-only: these
// scrape prices, they never place orders (submitOrder throws).
//
// Reliability contract (matches skills/grocery compareOneItem): searchProducts() throws when
// credentials are missing/expired or the request fails, so the comparison falls back to the
// last cached price for that store instead of crashing.

import { defineConnector, type ProviderHealth } from '@lifeos/provider-sdk';
import type { CartLine, GroceryProviderPort, Product, SubmittedOrder } from '@lifeos/skill-grocery';

/** Per-connector settings. Secrets (cookie/token) come from env — never hardcoded. */
export interface QuickCommerceConfig {
  /** Connector key, e.g. 'blinkit' — also the price-cache column key. */
  key: string;
  baseUrl: string;
  /** Static headers (User-Agent, X-App-Version, …). */
  headers?: Record<string, string>;
  /** Cookie / token header value, typically read from env. Absent → connector is unhealthy. */
  cookie?: string;
  /** Requests/min ceiling; requests are spaced to honor it. */
  rateLimitPerMin?: number;
  timeoutMs?: number;
  retries?: number;
  /** Residential proxy URL (http[s]://user:pass@host:port); applied via undici when present. */
  proxyUrl?: string;
  /** Delivery pincode the search is localized to. */
  defaultPincode?: string;
}

export interface SearchContext {
  pincode: string;
  config: QuickCommerceConfig;
}

export interface HttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
}

/** What a platform module must provide to become a connector. */
export interface JsonConnectorSpec {
  config: QuickCommerceConfig;
  /** Query used to health-check the endpoint. Defaults to 'milk'. */
  probeQuery?: string;
  /** Builds the authenticated search request for a query at a location. */
  buildSearch(query: string, ctx: SearchContext): HttpRequest;
  /** Maps the raw JSON response into normalized products. Must be defensive: return [] on an
   *  unexpected shape rather than throwing. */
  parse(raw: unknown): Product[];
}

/** Rupees (major units) → paise (minor units), the money unit the Skill uses. */
export function rupeesToMinor(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Maps a store's stock signal to our fine-grained enum. */
export function stockStatusOf(inStock: boolean | undefined, qty?: number): Product['stockStatus'] {
  if (inStock === false) return 'out_of_stock';
  if (typeof qty === 'number') {
    if (qty <= 0) return 'out_of_stock';
    if (qty <= 5) return 'limited';
    return 'in_stock';
  }
  return inStock === true ? 'in_stock' : undefined;
}

/** Finds the first array in a JSON object at any of the given dot-paths (defensive nav). */
export function pickArray(raw: unknown, paths: string[]): unknown[] {
  for (const path of paths) {
    let cur: unknown = raw;
    for (const key of path.split('.')) {
      if (cur && typeof cur === 'object' && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (Array.isArray(cur)) return cur;
  }
  return Array.isArray(raw) ? (raw as unknown[]) : [];
}

// ── Defensive accessors for unverified JSON shapes ───────────────────────────
export function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}
export function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
export function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
export function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}

/** Strips undefined fields so optional props stay truly optional in the output. */
export function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

// ── Per-connector rate limiting: space requests to honor requests/min ─────────
const lastCallAt = new Map<string, number>();
async function rateLimit(key: string, perMin: number | undefined): Promise<void> {
  if (!perMin || perMin <= 0) return;
  const minGapMs = Math.ceil(60_000 / perMin);
  const now = Date.now();
  const prev = lastCallAt.get(key) ?? 0;
  const wait = prev + minGapMs - now;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt.set(key, Date.now());
}

/** Lazily builds an undici ProxyAgent dispatcher when a proxy is configured (best-effort). */
async function proxyDispatcher(proxyUrl: string | undefined): Promise<unknown> {
  if (!proxyUrl) return undefined;
  try {
    // Dynamic specifier so the compiler doesn't require undici's types — it ships with Node.
    const spec = 'undici';
    const undici = (await import(spec)) as { ProxyAgent: new (url: string) => unknown };
    return new undici.ProxyAgent(proxyUrl);
  } catch {
    return undefined; // undici unavailable — proceed without a proxy
  }
}

/** Authenticated JSON fetch with timeout, retries (exponential backoff), and optional proxy. */
export async function httpJson(req: HttpRequest, config: QuickCommerceConfig): Promise<unknown> {
  const timeoutMs = config.timeoutMs ?? 8000;
  const retries = config.retries ?? 2;
  const dispatcher = await proxyDispatcher(config.proxyUrl);
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...config.headers,
    ...req.headers,
    ...(config.cookie ? { cookie: config.cookie } : {}),
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await rateLimit(config.key, config.rateLimitPerMin);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(req.url, {
        method: req.method ?? 'GET',
        headers,
        body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit);
      clearTimeout(timer);
      if (!res.ok) throw new Error(`${config.key}: HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      // Exponential backoff before the next attempt (200ms, 400ms, …).
      if (attempt < retries) await new Promise((r) => setTimeout(r, 200 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${config.key}: request failed`);
}

/** Turns a platform spec into a read-only grocery connector for the Registry. */
export function defineJsonGroceryConnector(spec: JsonConnectorSpec): GroceryProviderPort {
  const { config } = spec;
  const pincode = config.defaultPincode ?? '400001';
  const probeQuery = spec.probeQuery ?? 'milk';

  const search = async (query: string): Promise<Product[]> => {
    if (!config.cookie) {
      throw new Error(`${config.key}: missing credentials (set the connector's cookie/token env var)`);
    }
    const raw = await httpJson(spec.buildSearch(query, { pincode, config }), config);
    return spec.parse(raw);
  };

  return defineConnector<GroceryProviderPort>({
    key: config.key,
    domain: 'grocery',
    async health(): Promise<ProviderHealth> {
      if (!config.cookie) return { healthy: false, details: 'missing credentials' };
      try {
        await search(probeQuery);
        return { healthy: true };
      } catch (error) {
        return { healthy: false, details: (error as Error).message };
      }
    },
    searchProducts: search,
    async submitOrder(): Promise<SubmittedOrder> {
      throw new Error(`${config.key}: order placement is not supported (read-only price scraper)`);
    },
  });
}

export type { CartLine };
