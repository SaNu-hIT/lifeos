# ADR-0002 — Monorepo with Turborepo + pnpm

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** CTO, Chief Architect
- **Tags:** repository, tooling, DX

Related: [03 Handbook §2](../03_LifeOS_Engineering_Handbook.md) · [08 ADR index](../08_ARCHITECTURE_DECISIONS.md)

## Context

LifeOS spans many packages (contracts, SDKs, AI core, many Skills, many connectors) and several apps (api, web, console, mobile). They share contracts that must stay in lockstep. We need a repository strategy that makes shared-contract changes atomic, keeps CI fast, and scales to 100+ engineers and hundreds of packages.

## Options considered

**A. Polyrepo** — one repo per package/app.
- Pros: independent versioning/ownership; smaller checkouts.
- Cons: cross-cutting contract changes require coordinated PRs across many repos; version skew; painful local dev; duplicated tooling. Bad fit for a platform whose value is shared contracts.

**B. Monorepo, npm/yarn workspaces, no build orchestrator.**
- Pros: atomic changes, shared tooling.
- Cons: slow, redundant builds/tests; no caching or affected-graph awareness at scale.

**C. Monorepo with Turborepo + pnpm workspaces.**
- Pros: atomic cross-package changes; pnpm's strict, content-addressed, fast installs; Turborepo's task graph, caching, and "only build/test affected packages." One CI graph. Excellent DX.
- Cons: monorepo tooling learning curve; requires discipline on package boundaries (which we want anyway).

## Trade-offs

| Axis | A (polyrepo) | B (workspaces) | C (Turborepo+pnpm) |
|------|--------------|----------------|--------------------|
| Atomic contract changes | poor | good | good |
| CI speed at scale | n/a | poor | excellent (caching/affected) |
| Install speed/strictness | varies | medium | excellent (pnpm) |
| Tooling consistency | poor | good | excellent |
| Onboarding | medium | good | good |

## Decision

Use a **single monorepo** managed by **Turborepo** with **pnpm** workspaces. Layout per [03 §2](../03_LifeOS_Engineering_Handbook.md): `apps/`, `packages/`, `skills/`, `connectors/`. Shared `tsconfig`/`eslint-config` packages enforce consistency; the Turborepo task graph runs lint/typecheck/test/build only for affected packages.

## Consequences

- ✅ A contract change and all its consumers update in one PR — no version skew.
- ✅ Fast CI via caching + affected-graph; fast, strict installs via pnpm.
- ✅ Uniform tooling and dependency-direction enforcement across all packages.
- ⚠️ The Flutter `mobile` app lives in the monorepo for source-of-truth co-location but uses its own Dart toolchain (Turborepo orchestrates JS/TS tasks; mobile build is a separate pipeline).
- ⚠️ Repo grows large over years → mitigated by sparse checkout/partial clone and Turborepo remote cache.

## Future impact

The monorepo is compatible with later service extraction ([ADR-0001](adr-0001-modular-monolith.md)) — a service is just an app consuming the same packages. **Revisit trigger:** if a third-party Skill ecosystem requires external contribution at scale, individual Skills/Connectors may move to their own repos consuming published `@lifeos/*` packages.
