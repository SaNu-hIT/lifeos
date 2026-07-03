// @lifeos/connector-zepto-live — a REAL scraper connector for Zepto's web frontend,
// alongside (not replacing) the simulated @lifeos/connector-zepto used for fast local
// dev/tests. Mirrors @lifeos/connector-blinkit-live's structure exactly (same
// GroceryProviderPort, same retry/health/cache-friendly shape) so the Skill and the
// Connector Registry treat every grocery connector identically (ADR-0005).
//
// Order placement is intentionally NOT supported here — same reasoning as the
// Blinkit live connector: read-only price scraper, not an unattended purchaser.

import type { ProviderHealth } from '@lifeos/contracts';
import { defineConnector } from '@lifeos/provider-sdk';
import type { GroceryProviderPort, Product, SubmittedOrder } from '@lifeos/skill-grocery';
import { PlaywrightPageDriver, type PageDriver, type PlaywrightPageDriverOptions } from './page-driver.js';

export type { PageDriver, ScrapedProduct } from './page-driver.js';
export { PlaywrightPageDriver, type PlaywrightPageDriverOptions } from './page-driver.js';

export interface ZeptoLiveConnectorOptions extends PlaywrightPageDriverOptions {
  /** Inject a fake driver in tests instead of launching a real browser. */
  driver?: PageDriver;
  /** How many times to retry a failed/timed-out search before reporting unhealthy. */
  retries?: number;
  /** How long a health() result stays cached, to avoid a real scrape on every check. */
  healthCacheMs?: number;
}

export function createZeptoLiveConnector(options: ZeptoLiveConnectorOptions = {}): GroceryProviderPort {
  const driver = options.driver ?? new PlaywrightPageDriver(options);
  const retries = options.retries ?? 1;
  const healthCacheMs = options.healthCacheMs ?? 30_000;

  let lastHealth: { result: ProviderHealth; at: number } | undefined;

  async function scrapeWithRetry(query: string): Promise<Product[]> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const scraped = await driver.search(query);
        return scraped.map((p, i) => ({
          id: `zepto-live-${slug(p.name)}-${i}`,
          name: p.name,
          priceMinor: p.priceMinor,
          unit: p.unit,
          rating: p.rating,
          ratingCount: p.ratingCount,
          available: p.available,
        }));
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('zepto-live: scrape failed');
  }

  return defineConnector<GroceryProviderPort>({
    key: 'zepto_live',
    domain: 'grocery',

    async health(): Promise<ProviderHealth> {
      if (lastHealth && Date.now() - lastHealth.at < healthCacheMs) return lastHealth.result;
      let result: ProviderHealth;
      try {
        await scrapeWithRetry('milk');
        result = { healthy: true };
      } catch (error) {
        result = { healthy: false, details: (error as Error).message };
      }
      lastHealth = { result, at: Date.now() };
      return result;
    },

    async searchProducts(query: string): Promise<Product[]> {
      return scrapeWithRetry(query);
    },

    async submitOrder(): Promise<SubmittedOrder> {
      throw new Error(
        'zepto_live: order placement is not supported by this connector (read-only price scraper)',
      );
    },
  });
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}
