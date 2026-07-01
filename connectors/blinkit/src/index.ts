// @lifeos/connector-blinkit — a real-shaped grocery Connector (Blinkit). It implements
// the domain GroceryProviderPort and would map to the vendor API; here it runs against
// a simulated catalog so the path is exercised without live credentials (deferred infra).
// Depends only on the SDK + the grocery domain contract, never on the platform core.

import type { ProviderHealth } from '@lifeos/contracts';
import { defineConnector } from '@lifeos/provider-sdk';
import type {
  CartLine,
  GroceryProviderPort,
  Product,
  SubmittedOrder,
} from '@lifeos/skill-grocery';

// Blinkit's (simulated) catalogue and price list, in paise.
const CATALOG: Product[] = [
  { id: 'blk-milk', name: 'Amul Milk', priceMinor: 5400, unit: 'litre' },
  { id: 'blk-bread', name: 'Brown Bread', priceMinor: 3500, unit: 'pack' },
  { id: 'blk-eggs', name: 'Farm Eggs', priceMinor: 8200, unit: 'dozen' },
];

const ETA_MINUTES = 12; // Blinkit's promise

export function createBlinkitConnector(): GroceryProviderPort {
  let sequence = 0;
  return defineConnector<GroceryProviderPort>({
    key: 'blinkit',
    domain: 'grocery',
    async health(): Promise<ProviderHealth> {
      return { healthy: true };
    },
    async searchProducts(query: string): Promise<Product[]> {
      const q = query.trim().toLowerCase();
      if (q.length === 0) return [...CATALOG];
      return CATALOG.filter((p) => p.name.toLowerCase().includes(q));
    },
    async submitOrder(userId: string, lines: CartLine[]): Promise<SubmittedOrder> {
      if (lines.length === 0) throw new Error('blinkit: cannot submit an empty order');
      sequence += 1;
      return { providerOrderId: `blinkit-${userId}-${sequence}`, etaMinutes: ETA_MINUTES };
    },
  });
}

/** Default instance for simple composition; use the factory when isolation matters. */
export const blinkitConnector = createBlinkitConnector();
