// Grocery domain model. Owned entirely by this Skill — the platform core knows
// nothing about groceries (docs/01 §2 "never optimize for Grocery", ADR-0001).

export interface Product {
  id: string;
  name: string;
  /** Price in minor units (paise), to avoid float money. */
  priceMinor: number;
  unit: string; // 'kg', 'pack', 'litre' ...
  /** Average star rating (e.g. 4.3), when the store exposes one. */
  rating?: number;
  /** How many ratings the average is based on. */
  ratingCount?: number;
  /** In stock right now. `undefined` means the store didn't say — treated as
   *  available so an unknown never hides a product or blocks a comparison. Derived from
   *  `stockStatus` when only the enum is known. */
  available?: boolean;
  // ── Rich product info (populated by JSON-API connectors; all optional) ──
  /** Brand name, e.g. "Amul". */
  brand?: string;
  /** Pack size / variant as shown, e.g. "1 L", "400 g". */
  size?: string;
  /** Maximum retail price in minor units (paise), when different from priceMinor. */
  mrpMinor?: number;
  /** Absolute discount off MRP in minor units (paise). */
  discountMinor?: number;
  /** Promised delivery time in minutes, e.g. 12. */
  deliveryEtaMinutes?: number;
  /** Product thumbnail image URL. */
  imageUrl?: string;
  /** Link to the product page at the store. */
  productUrl?: string;
  /** Finer-grained stock state than the `available` boolean. */
  stockStatus?: 'in_stock' | 'limited' | 'out_of_stock';
}

export interface CartLine {
  product: Product;
  quantity: number;
}

export interface Cart {
  userId: string;
  lines: CartLine[];
}

export type OrderStatus = 'placed' | 'failed';

export interface Order {
  id: string;
  userId: string;
  lines: CartLine[];
  totalMinor: number;
  status: OrderStatus;
  providerOrderId?: string;
  etaMinutes?: number;
  placedAt: string; // ISO-8601, from ctx.now (no hidden clocks)
}
