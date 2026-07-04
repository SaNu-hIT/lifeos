/** DI token for the PlanCapabilityLookupPort. */
export const PLAN_CAPABILITY_LOOKUP = Symbol('PLAN_CAPABILITY_LOOKUP');

export interface PlanSummary {
  key: string;
  name: string;
}

/**
 * Read-only capability→plan lookup, used by the Orchestrator to explain which plan
 * would unlock a capability the user asked for but doesn't have (docs/adr/adr-0006).
 * Never mutates a subscription — that stays SubscriptionService's job.
 */
export interface PlanCapabilityLookupPort {
  plansGranting(capabilityKey: string): Promise<PlanSummary[]>;
}
