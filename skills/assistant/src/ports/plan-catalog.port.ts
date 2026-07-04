// PlanCatalogPort — read-only view over the billing plan/capability tables the
// subscription system already owns (billing.plans, billing.plan_capabilities,
// billing.subscriptions). Deliberately narrow: this Skill only ever needs to know
// the user's current plan and which OTHER plans would unlock a given capability —
// it never mutates a plan (ADR-0004: no business logic in the AI/Skill layer beyond
// what it needs to explain itself to the user).

export interface PlanSummary {
  key: string;
  name: string;
}

export interface CapabilityUnlock {
  capabilityKey: string;
  /** Plans that grant this capability (may be empty if no plan currently does). */
  plans: PlanSummary[];
}

export interface PlanCatalogPort {
  /** The user's current active plan key, or undefined with no active subscription. */
  currentPlan(userId: string): Promise<string | undefined>;
  /** For each capability key given, which plans grant it. */
  plansGranting(capabilityKeys: string[]): Promise<CapabilityUnlock[]>;
}
