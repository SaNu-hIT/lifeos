import { describe, expect, it } from 'vitest';
import { runProviderContractTests } from '@lifeos/provider-sdk';
import { runGroceryProviderContractTests } from '@lifeos/skill-grocery';
import { blinkitConnector, createBlinkitConnector } from '../src/index.js';

describe('@lifeos/connector-blinkit', () => {
  it('satisfies the base ProviderPort contract', async () => {
    await expect(runProviderContractTests(blinkitConnector)).resolves.not.toThrow();
  });

  it('satisfies the grocery domain provider contract (interchangeable behind the Skill)', async () => {
    await expect(runGroceryProviderContractTests(createBlinkitConnector())).resolves.not.toThrow();
  });

  it('searches its catalogue and returns provider-scoped order ids', async () => {
    const c = createBlinkitConnector();
    const found = await c.searchProducts('milk');
    expect(found.map((p) => p.name)).toContain('Amul Milk');

    const line = { product: found[0]!, quantity: 1 };
    const first = await c.submitOrder('u1', [line]);
    const second = await c.submitOrder('u1', [line]);
    expect(first.providerOrderId).toMatch(/^blinkit-u1-/);
    expect(first.providerOrderId).not.toBe(second.providerOrderId); // unique per order
    expect(first.etaMinutes).toBe(12);
  });

  it('refuses an empty order', async () => {
    await expect(createBlinkitConnector().submitOrder('u1', [])).rejects.toThrow(/empty order/);
  });
});
