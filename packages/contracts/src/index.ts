// @lifeos/contracts — the public surface of the LifeOS platform.
//
// Interfaces here are versioned and, once listed as frozen in docs/06_PROJECT_STATE.md,
// may only change via an ADR + version bump (semver: additive = minor, breaking = major).

/** The semantic version of the published contract surface. */
export const CONTRACTS_VERSION = '0.3.0' as const;

export type ContractsVersion = typeof CONTRACTS_VERSION;

// API edge
export * from './api/envelope.js';
export * from './api/errors.js';

// Identity
export * from './auth/auth-user.js';

// Permissions
export * from './permission/capability.js';

// Tools
export * from './tool/json-schema.js';
export * from './tool/tool.js';

// Context
export * from './context/context.js';

// Providers
export * from './provider/provider.js';

// Events
export * from './event/event.js';

// Skills
export * from './skill/manifest.js';

// Naming & validation invariants
export * from './naming.js';
