// Provider SDK base — connectors implement domain-shaped ports that extend this,
// and Skills never know which provider executes (docs/adr/adr-0005-provider-sdk.md).

export interface ProviderHealth {
  healthy: boolean;
  details?: string;
}

/** Base contract every Connector implements; domain ports extend this. */
export interface ProviderPort {
  readonly key: string;
  /** Domain that this provider serves, e.g. `grocery`. */
  readonly domain: string;
  health(): Promise<ProviderHealth>;
}
