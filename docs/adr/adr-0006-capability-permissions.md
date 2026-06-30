# ADR-0006 — Capability-Based Permissions (Subscriptions Don't Unlock Skills)

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** CTO, Security Architect, Product Architect
- **Tags:** permissions, monetization, security

Related: [02 §13](../02_LifeOS_Platform_Architecture.md) · [11 §2](../11_SECURITY_GUIDE.md) · [04 §5](../04_LifeOS_Product_Specification.md)

## Context

Access control and monetization are entangled if done naively. We need to gate what users can do, sell access in flexible ways (plans, trials, one-offs, partner bundles, admin grants), and keep Skills ignorant of billing. The tempting shortcut — "a subscription tier unlocks a set of Skills" — couples product packaging to code.

## Options considered

**A. Subscription tier → Skills directly** ("Pro unlocks Grocery + Fitness").
- Pros: simple to grasp.
- Cons: every pricing/packaging change (trials, promos, bundles, à-la-carte) requires code changes in Skills; Skills must know about plans; impossible to grant fine-grained access; mixing billing with authorization is a security smell.

**B. Role-based access control (RBAC).**
- Pros: standard, well-understood.
- Cons: roles are coarse; mapping monetization onto roles gets messy; cross-Skill, action-level gating (e.g. "can auto-order but not bulk-order") is awkward.

**C. Capability-based: Subscription → Capabilities → Permissions → Tools → Skills.**
- Pros: **capabilities** are the single currency of access; subscriptions, trials, admin grants, and bundles all just *grant capabilities*; tools require capabilities; Skills are unaware of billing; fine-grained and composable; monetization becomes configuration (`plan_capabilities` map, data not code).
- Cons: one extra layer of indirection to learn; need a capability taxonomy.

## Trade-offs

| Axis | A (tier→Skill) | B (RBAC) | C (capabilities) |
|------|----------------|----------|------------------|
| Packaging flexibility | poor | medium | excellent |
| Fine-grained gating | poor | medium | excellent |
| Skills unaware of billing | no | partial | yes |
| Security model clarity | poor | good | excellent |
| Indirection cost | none | low | one layer |

## Decision

Access is governed by **capabilities**. The chain is **Subscription → Capabilities → Permissions → Tools → Skills**. Subscriptions (and trials/admin grants/bundles) grant capabilities ([09 billing.\*](../09_DATABASE_DESIGN.md)); every **tool** declares a `requiredCapability`; the **Permission Engine** checks (user, capability, scope) and filters Context. **Subscriptions never reference Skills.** ([02 §13](../02_LifeOS_Platform_Architecture.md))

## Consequences

- ✅ New pricing/trials/bundles are configuration changes (`plan_capabilities`), not code.
- ✅ Skills contain zero billing/authorization logic — they just declare required capabilities on tools.
- ✅ Fine-grained, action-level control; the same check (`has capability?`) is used everywhere ([11 §2](../11_SECURITY_GUIDE.md)).
- ✅ Capabilities can be granted by any source (subscription, trial, partner, admin) uniformly.
- ⚠️ Requires maintaining a **capability taxonomy** (`<domain>.<action>`) — owned alongside contracts ([03 §4](../03_LifeOS_Engineering_Handbook.md)).
- ⚠️ Permission Engine is on the hot path → cached, but must stay correct (defense-in-depth with RLS).

## Future impact

This decouples monetization from engineering forever and generalizes from single-user to family/org accounts (grant capabilities to a principal). It is also what makes a third-party Skill marketplace safe: a Skill declares the capabilities it needs; the user grants or denies. **Foundational; changing it is a superseding ADR.**
