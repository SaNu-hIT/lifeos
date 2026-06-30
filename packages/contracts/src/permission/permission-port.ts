// The authorization boundary — see docs/adr/adr-0006-capability-permissions.md and
// docs/11_SECURITY_GUIDE.md §2. Every capability-gated action asks `can()`.

import type { CapabilityKey, PermissionDecision } from './capability.js';

/** DI token for the PermissionPort. */
export const PERMISSION_PORT = Symbol('PERMISSION_PORT');

export interface PermissionPort {
  /** Does the user hold this capability (in the given scope)? Deny by default. */
  can(userId: string, capability: CapabilityKey, scope?: string): Promise<PermissionDecision>;
  /** All capabilities the user currently holds (non-expired). */
  capabilitiesFor(userId: string): Promise<CapabilityKey[]>;
}
