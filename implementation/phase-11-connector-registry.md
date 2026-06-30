---
title: Phase 11 — Connector Registry & Provider SDK
status: Scaffold
band: Framework
phase: 11
depends_on: [3, 10]
estimate: 5–6 days
---

# Phase 11 — Connector Registry & Provider SDK

> Scaffold — deepen to the full 17-section spec (per [phase-01](phase-01-foundation.md)) before implementation. Spec refs: [02 §12](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0005](../docs/adr/adr-0005-provider-sdk.md) · [connector-template](../templates/connector-template.md).

## Overview
Build `@lifeos/provider-sdk` (domain-shaped ports, `defineConnector`, `runProviderContractTests`) and the **Connector Registry** that registers connectors and selects one per request by policy (availability/price/preference/geo) with failover/circuit-breaking. **No Skill knows which provider runs.**

## Objectives & Scope
- Provider SDK base: `ProviderPort`, `ProviderHealth`, per-domain port pattern (e.g. `GroceryProviderPort`).
- Connector Registry: register, select-by-policy, health-checks, failover, bulkhead isolation.
- Contract-test kit; recorded-fixture testing (offline CI).
- A sample/no-op connector proving the path.

## Key interfaces (to finalize)
```ts
export interface ConnectorRegistryPort {
  register(connector: ConnectorDescriptor): void;
  select<P extends ProviderPort>(domain: string, ctx: UnifiedContext, policy?: SelectionPolicy): P;
}
```

## Dependencies
Phase-03 (contracts), phase-10 (Skill framework consumes connectors via ports).

## Acceptance Criteria (draft)
- [ ] Connectors register and are selectable by policy; failover works.
- [ ] `runProviderContractTests` passes for the sample connector.
- [ ] Credentials scoped to connectors; never exposed upward ([11 §4](../docs/11_SECURITY_GUIDE.md)).

## Definition of Done (draft)
- [ ] Provider SDK published; registry wired; tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-11.md](../prompts/phase-11.md).

## Known Risks
- Designing sufficiently-general domain ports is hard → keep minimal; version the SDK.
- Selection policy complexity → start simple (preference + availability), extend later.

## Future Extension Points
Self-serve provider onboarding / connector marketplace; cost-latency telemetry feeding selection.
