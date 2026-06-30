// Capability-based access primitives — see docs/adr/adr-0006-capability-permissions.md.

/** A fine-grained unit of what a user may do, e.g. `grocery.order`. */
export type CapabilityKey = `${string}.${string}`;

/** A resolved authorization decision for (user, capability, scope). */
export interface PermissionDecision {
  allow: boolean;
  reason?: string;
}
