// Domain contract-test kit for grocery connectors. The Provider SDK's
// runProviderContractTests only checks the BASE ProviderPort; this verifies the
// grocery-SHAPED behaviour, so every connector (Blinkit, Zepto, Instamart …) is
// provably interchangeable behind the Skill (ADR-0005). Connectors call it in tests.

import type { CartLine } from './domain/types.js';
import type { GroceryProviderPort } from './ports/grocery-provider.port.js';

export async function runGroceryProviderContractTests(provider: GroceryProviderPort): Promise<void> {
  const errors: string[] = [];

  if (provider.domain !== 'grocery') errors.push(`domain must be 'grocery', got '${provider.domain}'`);
  const health = await provider.health();
  if (typeof health.healthy !== 'boolean') errors.push('health() must return { healthy: boolean }');

  const products = await provider.searchProducts('milk');
  if (!Array.isArray(products)) errors.push('searchProducts() must return an array');
  for (const p of products) {
    if (typeof p.id !== 'string' || typeof p.name !== 'string') errors.push('product missing id/name');
    if (!Number.isInteger(p.priceMinor)) errors.push(`product ${p.id} priceMinor must be an integer`);
  }

  const line: CartLine = {
    product: { id: 'contract_probe', name: 'Probe', priceMinor: 100, unit: 'unit' },
    quantity: 1,
  };
  const submitted = await provider.submitOrder('contract-user', [line]);
  if (typeof submitted.providerOrderId !== 'string' || submitted.providerOrderId.length === 0) {
    errors.push('submitOrder() must return a non-empty providerOrderId');
  }
  if (!Number.isFinite(submitted.etaMinutes)) errors.push('submitOrder() must return numeric etaMinutes');

  if (errors.length > 0) {
    throw new Error(`Grocery provider contract failed for "${provider.key}":\n- ${errors.join('\n- ')}`);
  }
}

/**
 * Contract kit for READ-ONLY connectors (live price scrapers that don't place orders and
 * need credentials/network to search). Verifies the grocery shape without calling
 * searchProducts (that's covered by each connector's parser fixture tests) and requires
 * submitOrder to be refused — so a scraper can never accidentally place a real order.
 */
export async function runReadOnlyGroceryProviderContractTests(provider: GroceryProviderPort): Promise<void> {
  const errors: string[] = [];

  if (provider.domain !== 'grocery') errors.push(`domain must be 'grocery', got '${provider.domain}'`);
  const health = await provider.health();
  if (typeof health.healthy !== 'boolean') errors.push('health() must return { healthy: boolean }');

  const line: CartLine = {
    product: { id: 'contract_probe', name: 'Probe', priceMinor: 100, unit: 'unit' },
    quantity: 1,
  };
  let refused = false;
  try {
    await provider.submitOrder('contract-user', [line]);
  } catch {
    refused = true;
  }
  if (!refused) errors.push('read-only connector must reject submitOrder()');

  if (errors.length > 0) {
    throw new Error(`Read-only grocery provider contract failed for "${provider.key}":\n- ${errors.join('\n- ')}`);
  }
}
