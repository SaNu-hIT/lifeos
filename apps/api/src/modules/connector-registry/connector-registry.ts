import {
  type ConnectorRegistryPort,
  ErrorCodes,
  LifeOSError,
  type ProviderPort,
  type SelectionPolicy,
} from '@lifeos/contracts';
import type { ConnectorsRepository } from './adapters/out/connectors.repository.js';

/**
 * Registers Connectors and selects one per request by policy, with health-based
 * failover. No Skill knows which provider runs (docs/adr/adr-0005-provider-sdk.md).
 * The registry imports no Connector — they register at boot via manifests.
 */
export class ConnectorRegistry implements ConnectorRegistryPort {
  private readonly byDomain = new Map<string, ProviderPort[]>();

  constructor(private readonly repo: ConnectorsRepository) {}

  register(connector: ProviderPort): void {
    const list = this.byDomain.get(connector.domain) ?? [];
    if (list.some((c) => c.key === connector.key)) {
      throw new Error(`connector already registered: ${connector.key}`);
    }
    list.push(connector);
    this.byDomain.set(connector.domain, list);
    // Persist a summary (fire-and-forget is fine; registration is idempotent).
    void this.repo.upsert(connector.key, connector.domain);
  }

  list(domain?: string): ProviderPort[] {
    if (domain) return [...(this.byDomain.get(domain) ?? [])];
    return [...this.byDomain.values()].flat();
  }

  async select<P extends ProviderPort = ProviderPort>(
    domain: string,
    policy?: SelectionPolicy,
  ): Promise<P> {
    const candidates = this.byDomain.get(domain) ?? [];
    if (candidates.length === 0) {
      throw new LifeOSError({
        code: ErrorCodes.DEPENDENCY_UNAVAILABLE,
        status: 503,
        message: `no connector registered for domain: ${domain}`,
      });
    }

    // Try the preferred connector first, then fail over to any healthy one.
    const ordered = policy?.preferred
      ? [
          ...candidates.filter((c) => c.key === policy.preferred),
          ...candidates.filter((c) => c.key !== policy.preferred),
        ]
      : candidates;

    for (const connector of ordered) {
      if (await this.isHealthy(connector)) return connector as P;
    }

    throw new LifeOSError({
      code: ErrorCodes.DEPENDENCY_UNAVAILABLE,
      status: 503,
      message: `no healthy connector for domain: ${domain}`,
      retryable: true,
    });
  }

  private async isHealthy(connector: ProviderPort): Promise<boolean> {
    try {
      return (await connector.health()).healthy;
    } catch {
      return false; // a throwing provider is treated as unhealthy (bulkhead)
    }
  }
}
