// @lifeos/contracts — the public surface of the LifeOS platform.
//
// Phase 01 ships this as an intentional placeholder. The real platform contracts
// (Tool, UnifiedContext, SkillManifest, ProviderPort, CapabilityKey, DomainEvent,
// LifeOSError, ApiResponse, ...) are defined and FROZEN starting in Phase 02/03.
// See docs/06_PROJECT_STATE.md for the frozen-contract register and version.

/** The semantic version of the published contract surface. */
export const CONTRACTS_VERSION = '0.0.0' as const;

export type ContractsVersion = typeof CONTRACTS_VERSION;
