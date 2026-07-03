// @lifeos/connector-blinkit-live — a REAL scraper connector for Blinkit's web
// frontend, alongside (not replacing) the simulated @lifeos/connector-blinkit used
// for fast local dev/tests. Implements the same GroceryProviderPort so the Skill and
// the Connector Registry treat it identically to every other grocery connector
// (ADR-0005) — compare_prices doesn't know or care that this one hits a real site.
//
// Order placement is intentionally NOT supported here: submitOrder() throws. Placing
// a real purchase via unattended browser automation is a materially different, much
// higher-risk feature (real money, real delivery address, payment method) than price
// scraping, and was not part of what was asked for — this connector is read-only.

import type { ProviderHealth } from '@lifeos/contracts';
import { defineConnector } from '@lifeos/provider-sdk';
import type { GroceryProviderPort, Product, SubmittedOrder } from '@lifeos/skill-grocery';
import { PlaywrightPageDriver, type PageDriver, type PlaywrightPageDriverOptions } from './page-driver.js';

export type { PageDriver, ScrapedProduct } from './page-driver.js';
export { PlaywrightPageDriver, type PlaywrightPageDriverOptions } from './page-driver.js';

export interface BlinkitLiveConnectorOptions extends PlaywrightPageDriverOptions {
  /** Inject a fake driver in tests instead of launching a real browser. */
  driver?: PageDriver;
  /** How many times to retry a failed/timed-out search before reporting unhealthy. */
  retries?: number;
  /** How long a health() result stays cached, to avoid a real scrape on every check. */
  healthCacheMs?: number;
}

export function createBlinkitLiveConnector(options: BlinkitLiveConnectorOptions = {}): GroceryProviderPort {
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
          id: `blinkit-live-${slug(p.name)}-${i}`,
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
    throw lastError instanceof Error ? lastError : new Error('blinkit-live: scrape failed');
  }

  return defineConnector<GroceryProviderPort>({
    key: 'blinkit_live',
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
        'blinkit_live: order placement is not supported by this connector (read-only price scraper)',
      );
    },
  });
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}
