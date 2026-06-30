# ADR-0005 — Provider SDK / Connector Abstraction

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Chief Architect
- **Tags:** connectors, providers, extensibility

Related: [02 §12](../02_LifeOS_Platform_Architecture.md) · [connector-template](../../templates/connector-template.md)

## Context

Skills act through external providers (grocery: Blinkit, Zepto, Instamart, BigBasket; shopping: Amazon, Flipkart; later: many per domain). Providers come and go, differ per region, and vary in price/availability. A Skill must never depend on a specific provider, and adding/removing a provider must not touch Skill logic.

## Options considered

**A. Skills call provider APIs directly.**
- Pros: simplest path for one provider.
- Cons: Skill coupled to a vendor's API; multi-provider/failover impossible without rewriting the Skill; credentials leak into Skill code; testing requires live vendors.

**B. A shared "providers" utility module Skills import functions from.**
- Pros: some reuse.
- Cons: still couples Skills to provider-shaped functions; no clean selection/failover; weak boundary.

**C. Provider SDK (domain-shaped ports) + Connector Registry that selects an implementation per request.**
- Pros: Skills depend on a **domain port** (`GroceryProviderPort.placeOrder`), never a vendor; connectors are independent packages implementing the port; the registry selects by policy (availability/price/preference/geo) and fails over; credentials scoped to connectors; connectors verified by a shared contract-test suite.
- Cons: requires designing good domain-shaped interfaces; an indirection layer.

## Trade-offs

| Axis | A (direct) | B (utils) | C (Provider SDK) |
|------|-----------|-----------|------------------|
| Skill–vendor decoupling | none | weak | complete |
| Multi-provider + failover | no | hard | built-in |
| Credential isolation | poor | poor | strong |
| Testability (offline) | poor | medium | excellent (fixtures) |
| Effort to add a provider | n/a | medium | low (implement port + pass contract tests) |

## Decision

Define a **Provider SDK** of domain-shaped ports per domain (e.g. `GroceryProviderPort`). Each provider is an independent **Connector** package implementing the relevant port. A **Connector Registry** selects a connector per request by configurable policy and provides failover/circuit-breaking. **No Skill knows which provider executes.** Connectors must pass `runProviderContractTests` ([12 §2](../12_TESTING_GUIDE.md)).

## Consequences

- ✅ Add/remove/failover providers with zero Skill changes.
- ✅ Provider selection (price, speed, user preference from Memory, region) is configuration/policy, not Skill code ([03 §6](../03_LifeOS_Engineering_Handbook.md)).
- ✅ Credentials isolated to connectors; never exposed to Skills, AI, or clients ([11 §4](../11_SECURITY_GUIDE.md)).
- ✅ Offline, deterministic connector tests via recorded fixtures.
- ⚠️ Designing stable, sufficiently-general domain ports is hard — versioned in `@lifeos/provider-sdk` and treated as a public contract ([06](../06_PROJECT_STATE.md)).

## Future impact

This is what enables a **Connector marketplace** and self-serve provider onboarding (a partner ships a connector that passes the contract suite). **Revisit trigger:** if a domain's providers diverge so much that one port can't fit, introduce a versioned port variant — a new ADR, not a Skill change.
