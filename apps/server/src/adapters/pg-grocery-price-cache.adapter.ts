// Postgres-backed GroceryPriceCachePort — the reliability layer behind
// grocery.compare_prices. Store prices aren't user data, so this runs in service
// context (no RLS) like other platform-owned reference data.

import type { DatabasePort } from '@lifeos/api';
import type { CachedPrice, GroceryPriceCachePort } from '@lifeos/skill-grocery';

interface PriceCacheRow {
  store_key: string;
  product_query: string;
  product_name: string;
  price_minor: number;
  unit: string;
  scraped_at: string;
  rating: string | number | null;
  rating_count: number | null;
  available: boolean | null;
  brand: string | null;
  size: string | null;
  mrp_minor: number | null;
  discount_minor: number | null;
  delivery_eta_minutes: number | null;
  image_url: string | null;
  product_url: string | null;
  stock_status: string | null;
}

function toCachedPrice(row: PriceCacheRow): CachedPrice {
  return {
    storeKey: row.store_key,
    productQuery: row.product_query,
    productName: row.product_name,
    priceMinor: row.price_minor,
    unit: row.unit,
    scrapedAt: new Date(row.scraped_at).toISOString(),
    // `numeric` comes back as a string from pg — normalize to a number.
    ...(row.rating != null ? { rating: Number(row.rating) } : {}),
    ...(row.rating_count != null ? { ratingCount: row.rating_count } : {}),
    ...(row.available != null ? { available: row.available } : {}),
    ...(row.brand != null ? { brand: row.brand } : {}),
    ...(row.size != null ? { size: row.size } : {}),
    ...(row.mrp_minor != null ? { mrpMinor: row.mrp_minor } : {}),
    ...(row.discount_minor != null ? { discountMinor: row.discount_minor } : {}),
    ...(row.delivery_eta_minutes != null ? { deliveryEtaMinutes: row.delivery_eta_minutes } : {}),
    ...(row.image_url != null ? { imageUrl: row.image_url } : {}),
    ...(row.product_url != null ? { productUrl: row.product_url } : {}),
    ...(row.stock_status != null
      ? { stockStatus: row.stock_status as 'in_stock' | 'limited' | 'out_of_stock' }
      : {}),
  };
}

export class PgGroceryPriceCacheAdapter implements GroceryPriceCachePort {
  constructor(private readonly db: DatabasePort) {}

  async get(storeKey: string, productQuery: string): Promise<CachedPrice | undefined> {
    const r = await this.db.query<PriceCacheRow>(
      `select store_key, product_query, product_name, price_minor, unit, scraped_at,
              rating, rating_count, available,
              brand, size, mrp_minor, discount_minor, delivery_eta_minutes,
              image_url, product_url, stock_status
         from grocery.price_cache
        where store_key = $1 and product_query = $2`,
      [storeKey, productQuery],
    );
    return r.rows[0] ? toCachedPrice(r.rows[0]) : undefined;
  }

  async set(entry: CachedPrice): Promise<void> {
    await this.db.query(
      `insert into grocery.price_cache
         (store_key, product_query, product_name, price_minor, unit, scraped_at,
          rating, rating_count, available,
          brand, size, mrp_minor, discount_minor, delivery_eta_minutes,
          image_url, product_url, stock_status)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       on conflict (store_key, product_query)
       do update set product_name = excluded.product_name,
                      price_minor = excluded.price_minor,
                      unit = excluded.unit,
                      scraped_at = excluded.scraped_at,
                      rating = excluded.rating,
                      rating_count = excluded.rating_count,
                      available = excluded.available,
                      brand = excluded.brand,
                      size = excluded.size,
                      mrp_minor = excluded.mrp_minor,
                      discount_minor = excluded.discount_minor,
                      delivery_eta_minutes = excluded.delivery_eta_minutes,
                      image_url = excluded.image_url,
                      product_url = excluded.product_url,
                      stock_status = excluded.stock_status`,
      [
        entry.storeKey,
        entry.productQuery,
        entry.productName,
        entry.priceMinor,
        entry.unit,
        entry.scrapedAt,
        entry.rating ?? null,
        entry.ratingCount ?? null,
        entry.available ?? null,
        entry.brand ?? null,
        entry.size ?? null,
        entry.mrpMinor ?? null,
        entry.discountMinor ?? null,
        entry.deliveryEtaMinutes ?? null,
        entry.imageUrl ?? null,
        entry.productUrl ?? null,
        entry.stockStatus ?? null,
      ],
    );
  }
}
