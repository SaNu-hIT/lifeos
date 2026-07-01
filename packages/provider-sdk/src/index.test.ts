import { describe, expect, it } from 'vitest';
import type { ProviderPort } from '@lifeos/contracts';
import { checkConnectorContract, defineConnector, runProviderContractTests } from './index.js';

function connector(overrides: Partial<ProviderPort> = {}): ProviderPort {
  return {
    key: 'zepto',
    domain: 'grocery',
    health: async () => ({ healthy: true }),
    ...overrides,
  };
}

describe('provider-sdk', () => {
  it('defineConnector returns a valid connector', () => {
    const c = connector();
    expect(defineConnector(c)).toBe(c);
  });

  it('defineConnector rejects invalid key/domain', () => {
    expect(() => defineConnector(connector({ key: 'Zepto!' }))).toThrow(/Invalid connector/);
  });

  it('checkConnectorContract flags a missing health method', () => {
    const bad = { key: 'x', domain: 'grocery' } as unknown as ProviderPort;
    expect(checkConnectorContract(bad).some((e) => e.includes('health'))).toBe(true);
  });

  it('runProviderContractTests passes for a healthy connector', async () => {
    await expect(runProviderContractTests(connector())).resolves.toBeUndefined();
  });
});
