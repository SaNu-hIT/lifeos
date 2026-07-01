// Grocery domain model. Owned entirely by this Skill — the platform core knows
// nothing about groceries (docs/01 §2 "never optimize for Grocery", ADR-0001).

export interface Product {
  id: string;
  name: string;
  /** Price in minor units (paise), to avoid float money. */
  priceMinor: number;
  unit: string; // 'kg', 'pack', 'litre' ...
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
