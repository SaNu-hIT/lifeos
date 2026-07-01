import { describe, expect, it } from 'vitest';
import { runProviderContractTests } from '@lifeos/provider-sdk';
import { sampleConnector } from '../src/index.js';

describe('@lifeos/connector-sample', () => {
  it('passes the provider contract kit', async () => {
    await expect(runProviderContractTests(sampleConnector)).resolves.toBeUndefined();
  });
});
