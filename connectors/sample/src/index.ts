// @lifeos/connector-sample — a trivial reference Connector proving the provider path.
// Implements the base ProviderPort; a real connector implements a domain-shaped port
// (e.g. GroceryProviderPort) and maps it to a vendor API. Depends only on the SDK +
// contracts, never on the platform core (ADR-0001).

import type { ProviderHealth } from '@lifeos/contracts';
import { defineConnector } from '@lifeos/provider-sdk';

export const sampleConnector = defineConnector({
  key: 'sample',
  domain: 'sample',
  async health(): Promise<ProviderHealth> {
    return { healthy: true };
  },
});
