// The price-cache port backs the "works any time" reliability requirement for
// grocery.compare_prices: every successful live scrape writes here, and a failed/
// timed-out scrape falls back to the last cached value instead of erroring or
// silently dropping a store from the comparison (docs: shopping-list price
// comparison plan).

export interface CachedPrice {
  storeKey: string;
  productQuery: string;
  productName: string;
  priceMinor: number;
  unit: string;
  scrapedAt: string;
  /** Average star rating at scrape time, if the store exposed one. */
  rating?: number;
  /** How many ratings the average is based on. */
  ratingCount?: number;
  /** Whether the product was in stock at scrape time (undefined = unknown). */
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

export interface GroceryPriceCachePort {
  get(storeKey: string, productQuery: string): Promise<CachedPrice | undefined>;
  set(entry: CachedPrice): Promise<void>;
}
