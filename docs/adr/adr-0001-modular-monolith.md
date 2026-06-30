# ADR-0001 — Modular Monolith, Microservice-Ready

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** CTO, Chief Architect
- **Tags:** architecture, deployment, scalability

Related: [02 Architecture](../02_LifeOS_Platform_Architecture.md) · [08 ADR index](../08_ARCHITECTURE_DECISIONS.md) · [13 Deployment](../13_DEPLOYMENT_GUIDE.md)

## Context

LifeOS must go from **1 developer to 100+ engineers** and from **1 Skill to 1000+** over 5–10 years. We need an architecture that ships fast now (single dev, single Skill, fast iteration) **and** does not require a rewrite when the team and load grow. The two failure modes to avoid: (a) a tangled monolith with no internal boundaries that becomes unmaintainable, and (b) a premature microservice mesh that imposes distributed-systems overhead (network failure, eventual consistency, ops complexity) on a one-person team.

## Options considered

**A. Microservices from day one** — each engine/Skill its own service.
- Pros: independent deploys, clear team ownership eventually, isolated scaling.
- Cons: crushing overhead for a tiny team; distributed transactions, network failure modes, and ops cost *before any product exists*; premature service boundaries are usually wrong and expensive to move.

**B. Big-ball-of-mud monolith** — one app, no internal boundaries.
- Pros: fastest to write initially.
- Cons: no seams → every later change risks the whole system; impossible to parallelize 100 engineers; cannot extract anything without a rewrite. Violates "scalable by default."

**C. Modular Monolith with hard internal boundaries (ports/adapters + events), microservice-ready.**
- Pros: one deployable (simple ops, simple local dev) with **enforced module boundaries**; modules talk via interfaces and events, so a module can later become a service by promoting an in-process port to a network port. Best of both.
- Cons: discipline required to keep boundaries clean (mitigated by lint rules + CI dependency checks).

## Trade-offs

| Axis | A (microservices) | B (mud) | C (modular monolith) |
|------|-------------------|---------|----------------------|
| Initial velocity | low | high | high |
| Ops complexity now | high | low | low |
| Maintainability at scale | high | very low | high |
| Cost to extract services later | n/a | rewrite | low (promote ports) |
| Fit for 1 dev today | poor | risky | excellent |
| Fit for 100 devs later | excellent | poor | excellent |

## Decision

Build LifeOS as a **Modular Monolith** (single NestJS deployable) with **hexagonal module boundaries** and **event-driven** inter-module communication. The **core never imports a Skill/Tool/Connector** — they register via manifests through registries. Boundaries are enforced mechanically (ESLint dependency rules + a CI dependency-direction check).

## Consequences

- ✅ One process to run, deploy, and debug now; fast local DX.
- ✅ Clean seams: extracting a hot module (AI Core, Memory, Workflow) into a service later means swapping an in-process adapter for a network adapter — no domain rewrite ([13 §6](../13_DEPLOYMENT_GUIDE.md)).
- ✅ 100 engineers can own modules independently.
- ⚠️ Requires constant boundary discipline; without enforcement it decays into Option B. → We enforce via lint + CI ([03 §2](../03_LifeOS_Engineering_Handbook.md)).
- ⚠️ Some "monolith" scaling limits (single deploy unit) until services are extracted — acceptable for years.

## Future impact

This decision underpins the entire roadmap's "platform-first" order and the deployment scaling story. **Revisit trigger:** when a single module's load or team ownership makes the shared deploy a bottleneck, extract that module per [13 §6](../13_DEPLOYMENT_GUIDE.md) — recorded as a new ADR, not by superseding this one.
