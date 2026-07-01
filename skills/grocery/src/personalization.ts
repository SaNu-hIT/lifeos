// Pure personalization logic — derives shopping habits from order history. No I/O,
// so it is trivially testable and provider-agnostic (ADR-0004: logic lives here).

import type { Order, Product } from './domain/types.js';

export interface Staple {
  product: Product;
  /** How many distinct orders contained this product. */
  orderCount: number;
}

/**
 * A "staple" is a product the user has ordered in at least `minOrders` distinct
 * orders — a habit worth surfacing (e.g. "usually buys oat milk"). Ranked by
 * frequency, then name for determinism.
 */
export function deriveStaples(orders: Order[], minOrders = 2): Staple[] {
  const counts = new Map<string, Staple>();
  for (const order of orders) {
    // Count each product at most once per order (distinct-order frequency).
    const seen = new Set<string>();
    for (const line of order.lines) {
      if (seen.has(line.product.id)) continue;
      seen.add(line.product.id);
      const entry = counts.get(line.product.id);
      if (entry) entry.orderCount += 1;
      else counts.set(line.product.id, { product: line.product, orderCount: 1 });
    }
  }
  return [...counts.values()]
    .filter((s) => s.orderCount >= minOrders)
    .sort((a, b) => b.orderCount - a.orderCount || a.product.name.localeCompare(b.product.name));
}
