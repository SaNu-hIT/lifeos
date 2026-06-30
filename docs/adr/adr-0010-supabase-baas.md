# ADR-0010 — Supabase as Initial BaaS, Behind Abstractions (with an Exit Strategy)

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** CTO, DevOps Architect
- **Tags:** infrastructure, vendor, deployment

Related: [13 §7](../13_DEPLOYMENT_GUIDE.md) · [09](../09_DATABASE_DESIGN.md)

## Context

A one-developer start needs Auth, a Postgres database, file storage, and realtime — without building and operating each from scratch. Supabase provides all four as managed services on standard Postgres. The risk with any BaaS is **lock-in**: if vendor-specific features become load-bearing in the domain, leaving later means a rewrite.

## Options considered

**A. Build/operate everything ourselves** (self-hosted Postgres, custom auth, S3, a realtime gateway) from day one.
- Pros: no vendor lock-in; full control.
- Cons: enormous ops burden for a tiny team; slow to first product; reinventing solved problems.

**B. Adopt Supabase and use its features freely** (vendor-coupled).
- Pros: fastest possible start; rich features.
- Cons: deep coupling (vendor auth semantics, RLS quirks, edge functions) makes leaving costly; domain tied to a vendor.

**C. Adopt Supabase **behind abstractions** (ports), using standard Postgres, with a documented exit path.**
- Pros: speed of B with the optionality of A; Auth behind `AuthPort`, Storage behind `StoragePort`, Realtime behind `RealtimePort`, DB behind repositories; nothing Supabase-only is load-bearing in the domain; standard Postgres schema.
- Cons: forgo some vendor conveniences; must maintain the abstractions and resist shortcuts.

## Trade-offs

| Axis | A (self-host) | B (coupled) | C (abstracted) |
|------|---------------|-------------|----------------|
| Time to first product | slow | fastest | fast |
| Ops burden now | high | low | low |
| Lock-in risk | none | high | low |
| Exit cost later | n/a | high | low (swap adapters) |
| Domain purity | n/a | poor | preserved |

## Decision

Use **Supabase** (Auth, Postgres, Storage, Realtime) initially, accessed **only through ports/adapters** ([ADR-0003](adr-0003-hexagonal-ddd.md)). The schema is **standard Postgres**; RLS is used (a Postgres feature, not Supabase-only). No Supabase-proprietary capability may become load-bearing in the domain. The exit path (self-hosted Postgres + an auth provider + S3-compatible storage + a realtime gateway) is documented in [13 §7](../13_DEPLOYMENT_GUIDE.md).

## Consequences

- ✅ Fast start; minimal ops for a small team; managed scaling early on.
- ✅ Leaving Supabase = swapping adapters, not rewriting the domain.
- ✅ pgvector, RLS, and standard SQL all transfer to any Postgres.
- ⚠️ We deliberately forgo some vendor conveniences (e.g. tight coupling to vendor edge functions) to preserve portability.
- ⚠️ Discipline required: no Supabase SDK calls in domain/application code — only in `adapters/out` ([03 §3](../03_LifeOS_Engineering_Handbook.md)).

## Future impact

This preserves the option to self-host or move clouds as scale/cost/compliance demand, without disrupting Skills or engines. **Revisit trigger:** cost, data-residency/compliance needs, or scale limits — evaluate migration via a new ADR; the abstractions make it a deployment change, not a redesign.
