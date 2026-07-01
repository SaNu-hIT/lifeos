import { describe, expect, it } from 'vitest';
import { runProviderContractTests } from '@lifeos/provider-sdk';
import { runGroceryProviderContractTests, type GroceryProviderPort } from '@lifeos/skill-grocery';
import { createZeptoConnector, zeptoConnector } from '../src/index.js';

describe('@lifeos/connector-zepto', () => {
  it('satisfies the base ProviderPort contract', async () => {
    await expect(runProviderContractTests(zeptoConnector)).resolves.not.toThrow();
  });

  it('satisfies the grocery domain provider contract (same port as Blinkit)', async () => {
    await expect(runGroceryProviderContractTests(createZeptoConnector())).resolves.not.toThrow();
  });

  it('searches its own catalogue and promises a faster ETA', async () => {
    const c = createZeptoConnector();
    const found = await c.searchProducts('milk');
    expect(found.map((p) => p.name)).toContain('Country Delight Milk');
    const order = await c.submitOrder('u1', [{ product: found[0]!, quantity: 2 }]);
    expect(order.providerOrderId).toMatch(/^zepto-u1-/);
    expect(order.etaMinutes).toBe(9);
  });

  it('reports an unhealthy status when out (so the registry can fail over)', async () => {
    const down = createZeptoConnector({ healthy: false });
    expect((await down.health()).healthy).toBe(false);
  });

  it('is interchangeable: the Skill only depends on the port, not the store', async () => {
    // A tool would hold a GroceryProviderPort; either connector fits without change.
    const providers: GroceryProviderPort[] = [createZeptoConnector(), zeptoConnector];
    for (const p of providers) expect(p.domain).toBe('grocery');
  });
});
