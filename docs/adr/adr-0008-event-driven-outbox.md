# ADR-0008 — Event-Driven with the Outbox Pattern + CQRS Read Models

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Chief Architect
- **Tags:** events, reliability, cqrs

Related: [02 §14](../02_LifeOS_Platform_Architecture.md) · [09 outbox](../09_DATABASE_DESIGN.md)

## Context

Skills must cooperate without coupling (Grocery places an order → Finance records spend → Activity feed updates → Notification sent), and these side effects must be **reliable** (no lost events, no phantom events on rollback). We also have read-heavy surfaces (home, activity feed) that should not be served by joining write-side tables. We need decoupled, reliable async messaging and fast reads.

## Options considered

**A. Direct synchronous calls between Skills/engines.**
- Pros: simple, immediate.
- Cons: tight coupling (Skill A imports Skill B — violates independence); cascading failures; slow turns; no audit of effects. Breaks the plugin model.

**B. Publish events directly to the queue from application code (no outbox).**
- Pros: decoupled, async.
- Cons: **dual-write problem** — if the DB commit succeeds but the publish fails (or vice versa), state and events diverge → lost or phantom events.

**C. Domain events via the Outbox pattern (write state + event in one transaction; relay to BullMQ) + CQRS read models for feeds/home.**
- Pros: events are **exactly consistent** with state changes; subscribers are decoupled and idempotent; read models give fast reads independent of writes; full audit of effects.
- Cons: at-least-once delivery requires idempotent handlers; eventual consistency for read models; a relay component to operate.

## Trade-offs

| Axis | A (direct) | B (naive publish) | C (outbox+CQRS) |
|------|-----------|-------------------|-----------------|
| Skill decoupling | none | good | good |
| Event reliability | n/a | poor (dual-write) | excellent |
| Read performance (feeds) | poor | poor | excellent |
| Operational complexity | low | low | medium (relay, idempotency) |
| Auditability of effects | poor | medium | excellent |

## Decision

Cross-cutting effects propagate as **domain events**. The producing use case writes domain state **and** an `outbox` row in the **same transaction**; an **outbox relay** publishes unsent rows to **BullMQ**; subscribers (Skills/engines) handle events **idempotently** (at-least-once). Read-heavy surfaces (Activity, Home) are **CQRS read models** built by event subscribers. Skills never call each other directly — only via events. ([02 §14](../02_LifeOS_Platform_Architecture.md), [09](../09_DATABASE_DESIGN.md))

## Consequences

- ✅ No lost/phantom events; state and events are consistent by construction.
- ✅ Skills cooperate with zero coupling (A emits, B reacts) — preserving plugin independence ([ADR-0001](adr-0001-modular-monolith.md)).
- ✅ Fast feeds/home via read models, decoupled from write paths.
- ✅ A natural audit trail of effects.
- ⚠️ Handlers **must** be idempotent (events deliver at-least-once) — enforced by convention + dedupe keys.
- ⚠️ Read models are eventually consistent — acceptable for feeds/home; the UI reflects this.
- ⚠️ Operating a relay + queue adds ops surface — owned in [phase-06](../05_IMPLEMENTATION_ROADMAP.md)/[33](../05_IMPLEMENTATION_ROADMAP.md).

## Future impact

Events are the inter-service contract after extraction ([ADR-0001](adr-0001-modular-monolith.md)) — in-process subscribers become networked consumers with no domain change. Enables analytics/CDC and proactive (event-triggered) assistance. **Foundational.**
