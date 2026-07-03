import { describe, expect, it } from 'vitest';
import { runProviderContractTests } from '@lifeos/provider-sdk';
import { createZeptoLiveConnector } from '../src/index.js';
import type { PageDriver, ScrapedProduct } from '../src/page-driver.js';

// No real network/browser in tests — a fake PageDriver stands in for Playwright.
class FixtureDriver implements PageDriver {
  calls: string[] = [];
  constructor(private readonly fixtures: Record<string, ScrapedProduct[] | Error>) {}

  async search(query: string): Promise<ScrapedProduct[]> {
    this.calls.push(query);
    const fixture = this.fixtures[query];
    if (fixture instanceof Error) throw fixture;
    return fixture ?? [];
  }

  async close(): Promise<void> {}
}

describe('@lifeos/connector-zepto-live', () => {
  it('satisfies the base ProviderPort contract', async () => {
    const driver = new FixtureDriver({ milk: [{ name: 'Amul Taaza Milk', priceMinor: 3000, unit: '500 ml' }] });
    const connector = createZeptoLiveConnector({ driver });
    await expect(runProviderContractTests(connector)).resolves.not.toThrow();
  });

  it('maps scraped products onto the Product shape', async () => {
    const driver = new FixtureDriver({
      milk: [{ name: 'Nandini Toned Fresh Milk', priceMinor: 2200, unit: '500 ml' }],
    });
    const connector = createZeptoLiveConnector({ driver });
    const found = await connector.searchProducts('milk');
    expect(found).toEqual([
      { id: expect.any(String), name: 'Nandini Toned Fresh Milk', priceMinor: 2200, unit: '500 ml' },
    ]);
  });

  it('reports unhealthy (not a thrown error) when the live scrape keeps failing', async () => {
    const driver = new FixtureDriver({ milk: new Error('site is down') });
    const connector = createZeptoLiveConnector({ driver, retries: 0 });
    const health = await connector.health();
    expect(health.healthy).toBe(false);
    expect(health.details).toMatch(/site is down/);
  });

  it('retries a failed scrape before giving up', async () => {
    let attempts = 0;
    const driver: PageDriver = {
      async search() {
        attempts += 1;
        if (attempts < 2) throw new Error('transient');
        return [{ name: 'Amul Taaza Milk', priceMinor: 3000, unit: '500 ml' }];
      },
      async close() {},
    };
    const connector = createZeptoLiveConnector({ driver, retries: 2 });
    const found = await connector.searchProducts('milk');
    expect(found).toHaveLength(1);
    expect(attempts).toBe(2);
  });

  it('refuses to place orders — read-only price scraper by design', async () => {
    const connector = createZeptoLiveConnector({ driver: new FixtureDriver({}) });
    await expect(
      connector.submitOrder('u1', [{ product: { id: 'p', name: 'x', priceMinor: 1, unit: 'u' }, quantity: 1 }]),
    ).rejects.toThrow(/not supported/);
  });
});
