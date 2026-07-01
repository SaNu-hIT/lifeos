// The domain-shaped provider port Grocery depends on. Real connectors (Blinkit,
// Zepto, Instamart) implement this in phase-25; the Skill never knows which one runs
// (ADR-0005). It extends ProviderPort so the Connector Registry can health-check it.

import type { ProviderPort } from '@lifeos/contracts';
import type { CartLine, Product } from '../domain/types.js';

export interface SubmittedOrder {
  providerOrderId: string;
  etaMinutes: number;
}

export interface GroceryProviderPort extends ProviderPort {
  readonly domain: 'grocery';
  searchProducts(query: string): Promise<Product[]>;
  submitOrder(userId: string, lines: CartLine[]): Promise<SubmittedOrder>;
}
