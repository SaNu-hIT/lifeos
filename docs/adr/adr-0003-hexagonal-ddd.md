# ADR-0003 — Hexagonal Architecture + DDD per Module

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Chief Architect
- **Tags:** architecture, code-structure

Related: [02 §4](../02_LifeOS_Platform_Architecture.md) · [03 §3](../03_LifeOS_Engineering_Handbook.md)

## Context

Skills and engines must be testable in isolation, swappable in their infrastructure (Postgres today, maybe another store later; OpenAI today, Claude later; Supabase today, self-host later — [ADR-0010](adr-0010-supabase-baas.md)), and resistant to framework lock-in. We need a consistent internal structure every module follows so 100 engineers and AI agents produce uniform code.

## Options considered

**A. Conventional layered MVC** (controllers → services → repositories, framework-centric).
- Pros: familiar, fast to start.
- Cons: business logic leaks into controllers/ORM; domain coupled to NestJS/Supabase; hard to test without infrastructure; swapping a provider ripples through logic.

**B. Transaction-script / anemic services.**
- Pros: simple for trivial CRUD.
- Cons: no domain model; logic scatters; doesn't scale to complex Skills (Finance, Travel).

**C. Hexagonal (Ports & Adapters) + DDD bounded contexts.**
- Pros: domain is pure and framework-free; infrastructure behind ports; each Skill/engine is a bounded context with its own language; trivially unit-testable with mocked ports; provider/store swaps are adapter changes.
- Cons: more upfront structure/boilerplate; learning curve.

## Trade-offs

| Axis | A (MVC) | B (scripts) | C (hexagonal+DDD) |
|------|---------|-------------|-------------------|
| Testability | medium | low | excellent |
| Framework/provider independence | low | low | excellent |
| Fit for complex Skills | medium | poor | excellent |
| Boilerplate | low | low | higher |
| Consistency across team | medium | low | excellent |

## Decision

Every module (engine and Skill) uses **Hexagonal architecture** with a **DDD** bounded context: `domain/` (entities, value objects, events, **ports**), `application/` (commands/queries/services), `adapters/in` and `adapters/out`. Dependencies point inward; the domain imports no framework, ORM, LLM, or Supabase. Structure is standardized in [03 §3](../03_LifeOS_Engineering_Handbook.md) and scaffolded by [module-template](../../templates/module-template.md).

## Consequences

- ✅ Pure, fast unit tests with mocked ports; high coverage achievable ([12](../12_TESTING_GUIDE.md)).
- ✅ Provider/store/LLM swaps are adapter changes — enabling [ADR-0005](adr-0005-provider-sdk.md), [ADR-0010](adr-0010-supabase-baas.md).
- ✅ Uniform structure across the codebase; templates make compliance the default.
- ⚠️ More files/indirection per module → mitigated by generators and templates.
- ⚠️ Requires enforcing "no framework import in domain" → ESLint rule + review ([03 §3](../03_LifeOS_Engineering_Handbook.md)).

## Future impact

Hexagonal ports are exactly the seams [ADR-0001](adr-0001-modular-monolith.md) promotes to network boundaries during service extraction. This decision is foundational and unlikely to be revisited; changing it would be a full restructure.
