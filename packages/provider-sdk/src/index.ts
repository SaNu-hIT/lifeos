// @lifeos/provider-sdk — the toolkit for building LifeOS Connectors.
//
// A Connector is an adapter implementing a domain-shaped provider port (which extends
// ProviderPort). Skills never know which connector runs (docs/adr/adr-0005-provider-sdk.md).
// Depends only on @lifeos/contracts — never on the platform core.

import type { ProviderHealth, ProviderPort } from '@lifeos/contracts';

export type { ProviderHealth, ProviderPort };

const KEY = /^[a-z][a-z0-9_]*$/;
const DOMAIN = /^[a-z][a-z0-9_]*$/;

/** Returns all contract problems with a connector (empty = valid). */
export function checkConnectorContract(connector: ProviderPort): string[] {
  const errors: string[] = [];
  if (!KEY.test(connector.key)) errors.push(`invalid connector key: ${connector.key}`);
  if (!DOMAIN.test(connector.domain)) errors.push(`invalid connector domain: ${connector.domain}`);
  if (typeof connector.health !== 'function') errors.push('connector has no health() method');
  return errors;
}

/** Define a Connector: validates the base contract at authoring time and returns it. */
export function defineConnector<T extends ProviderPort>(connector: T): T {
  const errors = checkConnectorContract(connector);
  if (errors.length > 0) {
    throw new Error(`Invalid connector "${connector.key}": ${errors.join('; ')}`);
  }
  return connector;
}

/**
 * Contract-test kit. Call inside a Connector's test suite. Verifies the base
 * ProviderPort contract (key, domain, and a working health()). Domain-specific port
 * methods are verified by that domain's own kit against recorded fixtures.
 */
export async function runProviderContractTests(connector: ProviderPort): Promise<void> {
  const errors = checkConnectorContract(connector);
  const health: ProviderHealth = await connector.health();
  if (typeof health.healthy !== 'boolean') {
    errors.push('health() must return { healthy: boolean }');
  }
  if (errors.length > 0) {
    throw new Error(`Provider contract failed for "${connector.key}":\n- ${errors.join('\n- ')}`);
  }
}
