import { describe, it, expect } from 'vitest';
import { CONTRACTS_VERSION } from './index.js';

// Trivial test proving the test runner works end-to-end (Phase 01 acceptance criterion).
describe('@lifeos/contracts', () => {
  it('exposes a contracts version', () => {
    expect(CONTRACTS_VERSION).toBe('0.1.0');
  });
});
