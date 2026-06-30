# ADR-0007 — Context Engine as the Single Data Boundary for Skills

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Chief Architect, Security Architect
- **Tags:** context, architecture, security

Related: [02 §8](../02_LifeOS_Platform_Architecture.md) · [11 §2](../11_SECURITY_GUIDE.md)

## Context

Skills need data about the user and the world (profile, history, memory, settings, current conversation). If each Skill queries the database directly, we lose a single place to enforce permissions, we duplicate data-gathering logic, we make Skills hard to test, and we risk cross-Skill data leakage. "Everything is Context" is a founding principle — it needs a mechanism.

## Options considered

**A. Skills query the database directly** (their own and shared tables).
- Pros: straightforward; no extra layer.
- Cons: no central permission filtering (leak risk); duplicated query logic; Skills coupled to schema; untestable without a DB; a buggy Skill can read data it shouldn't.

**B. A shared data-access library Skills import.**
- Pros: some reuse.
- Cons: still per-Skill calls; permission filtering not guaranteed; no single boundary; caching/auditing scattered.

**C. Context Engine assembles a permission-filtered Unified Context; Skills receive it and never query the DB for cross-cutting data.**
- Pros: one auditable, permission-filtered boundary; Skills are trivially testable with a fabricated context; central caching; data minimization by scope; consistent shape.
- Cons: the engine must know how to gather and filter context; a Skill's *own* domain tables still need a path (handled: Skills own their schema and use Context Providers to contribute, and the engine composes them).

## Trade-offs

| Axis | A (direct DB) | B (lib) | C (Context Engine) |
|------|---------------|---------|--------------------|
| Central permission filtering | none | weak | strong |
| Cross-Skill leak risk | high | medium | low |
| Skill testability | poor | medium | excellent |
| Caching/auditing | scattered | scattered | centralized |
| Indirection cost | none | low | one layer |

## Decision

The **Context Engine** assembles a typed **Unified Context** from Database + Memory + Conversation + Settings + Permissions, **filters it through the Permission Engine**, and passes it to every tool handler. Skills consume Unified Context and **do not query cross-cutting data directly**. A Skill's own domain tables are accessed only by that Skill, and it surfaces relevant data via **Context Providers** that the engine composes (with permission filtering). ([02 §8](../02_LifeOS_Platform_Architecture.md))

## Consequences

- ✅ Permission filtering happens in exactly one place; a Skill cannot see data its capabilities don't allow ([11 §2](../11_SECURITY_GUIDE.md)).
- ✅ Skills are unit-tested by fabricating a `UnifiedContext` — no database needed ([12](../12_TESTING_GUIDE.md)).
- ✅ Context assembly is cacheable (Redis, per user/scope) and auditable; data minimization by scope.
- ⚠️ The engine is on the hot path → cached with TTLs; cache invalidation on memory/settings change.
- ⚠️ Requires a disciplined `ContextProvider` interface so Skills contribute without bypassing filtering.

## Future impact

Centralizing context is what later enables edge/precomputed context, richer personalization, and safe third-party Skills (they only ever see filtered context). **Foundational.** Revisit only to change *how* context is assembled (e.g. streaming/partial context), not *whether* the boundary exists.
