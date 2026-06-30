// @lifeos/contracts — the public surface of the LifeOS platform.
//
// Interfaces here are versioned and, once listed as frozen in docs/06_PROJECT_STATE.md,
// may only change via an ADR + version bump. The full contract set (Tool,
// UnifiedContext, SkillManifest, ProviderPort, CapabilityKey, DomainEvent, ...) grows
// from Phase 03 onward; Phase 02 adds the API envelopes and LifeOSError.

/** The semantic version of the published contract surface. */
export const CONTRACTS_VERSION = '0.1.0' as const;

export type ContractsVersion = typeof CONTRACTS_VERSION;

export * from './api/envelope.js';
export * from './api/errors.js';
