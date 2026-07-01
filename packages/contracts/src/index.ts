// @lifeos/contracts — the public surface of the LifeOS platform.
//
// Interfaces here are versioned and, once listed as frozen in docs/06_PROJECT_STATE.md,
// may only change via an ADR + version bump (semver: additive = minor, breaking = major).

/** The semantic version of the published contract surface. */
export const CONTRACTS_VERSION = '0.7.0' as const;

export type ContractsVersion = typeof CONTRACTS_VERSION;

// API edge
export * from './api/envelope.js';
export * from './api/errors.js';

// Identity
export * from './auth/auth-user.js';

// Permissions
export * from './permission/capability.js';
export * from './permission/permission-port.js';

// Tools
export * from './tool/json-schema.js';
export * from './tool/tool.js';
export * from './tool/tool-registry.js';

// Context
export * from './context/context.js';

// Providers
export * from './provider/provider.js';
export * from './provider/connector-registry.js';

// Events
export * from './event/event.js';

// Skills
export * from './skill/manifest.js';
export * from './skill/skill-registry.js';

// Naming & validation invariants
export * from './naming.js';
