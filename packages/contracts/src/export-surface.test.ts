import { describe, expect, it } from 'vitest';
import * as contracts from './index.js';

// Backward-compatibility guard: removing or renaming a published export is a
// BREAKING change and must fail CI (it would require an ADR + major version bump,
// docs/08_ARCHITECTURE_DECISIONS.md). Additive changes (new exports) do NOT fail
// this test — this asserts a required subset is present, not an exact match.
const REQUIRED_EXPORTS = [
  'CONTRACTS_VERSION',
  // api
  'LifeOSError',
  'ErrorCodes',
  // naming/validation
  'isValidToolName',
  'isValidCapabilityKey',
  'isValidEventType',
  'validateSkillManifest',
] as const;

describe('contract export surface (backward-compat guard)', () => {
  it('keeps every required runtime export present', () => {
    const present = new Set(Object.keys(contracts));
    const missing = REQUIRED_EXPORTS.filter((name) => !present.has(name));
    expect(missing).toEqual([]);
  });
});
