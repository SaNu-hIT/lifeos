// @lifeos/connector-zepto — a second real-shaped grocery Connector (Zepto). Proves the
// Skill is provider-agnostic: it implements the SAME GroceryProviderPort as Blinkit, so
// the Connector Registry can select or fail over between them and the Skill never knows
// which store fulfilled the order (ADR-0005). Simulated catalogue; live API deferred.

import type { ProviderHealth } from '@lifeos/contracts';
import { defineConnector } from '@lifeos/provider-sdk';
import type {
  CartLine,
  GroceryProviderPort,
  Product,
  SubmittedOrder,
} from '@lifeos/skill-grocery';

// Zepto's (simulated) catalogue — different SKUs and prices from Blinkit.
const CATALOG: Product[] = [
  { id: 'zep-milk', name: 'Country Delight Milk', priceMinor: 5600, unit: 'litre' },
  { id: 'zep-bread', name: 'Multigrain Bread', priceMinor: 4000, unit: 'pack' },
  { id: 'zep-butter', name: 'Amul Butter', priceMinor: 6000, unit: 'pack' },
];

const ETA_MINUTES = 9; // Zepto's promise (faster than Blinkit)

export interface ZeptoConnectorOptions {
  /** Simulate an outage so failover to another connector can be exercised. */
  healthy?: boolean;
}

export function createZeptoConnector(options: ZeptoConnectorOptions = {}): GroceryProviderPort {
  const healthy = options.healthy ?? true;
  let sequence = 0;
  return defineConnector<GroceryProviderPort>({
    key: 'zepto',
    domain: 'grocery',
    async health(): Promise<ProviderHealth> {
      return healthy ? { healthy: true } : { healthy: false, details: 'simulated outage' };
    },
    async searchProducts(query: string): Promise<Product[]> {
      const q = query.trim().toLowerCase();
      if (q.length === 0) return [...CATALOG];
      return CATALOG.filter((p) => p.name.toLowerCase().includes(q));
    },
    async submitOrder(userId: string, lines: CartLine[]): Promise<SubmittedOrder> {
      if (lines.length === 0) throw new Error('zepto: cannot submit an empty order');
      sequence += 1;
      return { providerOrderId: `zepto-${userId}-${sequence}`, etaMinutes: ETA_MINUTES };
    },
  });
}

/** Default instance for simple composition; use the factory when isolation matters. */
export const zeptoConnector = createZeptoConnector();
