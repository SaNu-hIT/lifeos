// The Connector Registry — selects a provider per request by policy, with health-
// based failover. No Skill knows which provider runs (docs/adr/adr-0005-provider-sdk.md).

import type { ProviderPort } from './provider.js';

/** DI token for the ConnectorRegistryPort. */
export const CONNECTOR_REGISTRY = Symbol('CONNECTOR_REGISTRY');

/** Inputs that influence which connector is chosen for a request. */
export interface SelectionPolicy {
  /** Preferred connector key (e.g. from user preference in Memory). Tried first. */
  preferred?: string;
}

export interface ConnectorDescriptor {
  key: string;
  domain: string;
}

export interface ConnectorRegistryPort {
  register(connector: ProviderPort): void;
  list(domain?: string): ProviderPort[];
  /**
   * Select a healthy connector for the domain. Honors `policy.preferred` when healthy,
   * otherwise fails over to any healthy connector. Throws if none is available.
   */
  select<P extends ProviderPort = ProviderPort>(domain: string, policy?: SelectionPolicy): Promise<P>;
}
