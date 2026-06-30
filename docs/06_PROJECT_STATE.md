---
title: LifeOS Project State (LIVE)
status: Living
version: 1.0.0
last_updated: 2026-06-30
owner: Whoever last completed a phase
audience: AI agents (read FIRST) + reviewers
---

# 06 — PROJECT_STATE (LIVE)

> ⚠️ **This is the single living document.** AI agents MUST read this before doing anything (see [07](07_AI_AGENT_INSTRUCTIONS.md)). It is updated after **every** phase. If anything here is stale, fix it as part of your work.

> **How to update:** at the end of a phase, edit this file in the same PR — move the phase to *Completed*, set *Current/Next Phase*, bump *DB/API/Contract versions* if they changed, log new *Known Issues*, append to *Change Log*, set *Last Updated*.

---

## Snapshot

| Field | Value |
|-------|-------|
| **Current Phase** | _Phase 01 complete._ Ready to start Phase 02. |
| **Next Phase** | [phase-02 — Backend Bootstrap (NestJS)](../implementation/phase-02-backend.md) |
| **Last completed phase** | 01 — Foundation & Monorepo |
| **Contract version** (`@lifeos/contracts`) | `0.0.0` (placeholder package created; real contracts land in phase-02/03) |
| **Database version** (latest migration) | `0000` (none) |
| **API version** | unversioned (no API yet) |
| **Repo state** | Monorepo scaffolded (Turborepo + pnpm). Packages: `@lifeos/api`, `@lifeos/contracts`, `@lifeos/config`, `@lifeos/tsconfig`, `@lifeos/eslint-config`. Full gate (lint/typecheck/test/build) green. On branch `phase-01-foundation`. |
| **Last Updated** | 2026-06-30 |

## Completed phases

_None yet._ (When a phase completes, add a row: `| 01 | Foundation | 2026-… | PR #… | notes |`.)

| # | Phase | Date | PR | Notes |
|---|-------|------|----|----|
| 01 | Foundation & Monorepo | 2026-06-30 | (branch `phase-01-foundation`) | Turborepo+pnpm scaffold; dep-direction guardrail + negative test; CI; full gate green |

## Pending phases

Phases [02–36](05_IMPLEMENTATION_ROADMAP.md) are pending. Build order and dependencies: [05 Roadmap](05_IMPLEMENTATION_ROADMAP.md).

## Frozen public contracts

> Interfaces here are **frozen** — changing one requires an ADR + version bump + migration note. None exist yet; populate as `@lifeos/contracts` grows.

| Contract | Version | Defined in phase | Notes |
|----------|---------|------------------|-------|
| _none yet_ | — | — | — |

Expected early contracts (will be frozen as they land): `Tool`, `UnifiedContext`, `SkillManifest`, `ProviderPort`, `CapabilityKey`, `DomainEvent`, `LifeOSError`.

## Architecture decisions in force

All accepted ADRs apply ([08](08_ARCHITECTURE_DECISIONS.md)): ADR-0001 … ADR-0010. None superseded.

## Known issues / open questions

| ID | Description | Severity | Phase | Status |
|----|-------------|----------|-------|--------|
| KI-001 | Test runner is **vitest**, but [12 Testing Guide](12_TESTING_GUIDE.md) names Jest. Chosen for first-class TS/ESM support and speed. Revisit: either adopt vitest in the Testing Guide (preferred) or migrate to Jest. | low | 01 | open |
| KI-002 | Dependency-direction guardrail currently enforces only the **core→Skill/Connector** boundary via `no-restricted-imports`. The finer domain→framework rule ([03 §3](03_LifeOS_Engineering_Handbook.md)) is added as the layered modules appear (phase-02+). | low | 01 | open |

## Environment / external services

| Service | Status | Notes |
|---------|--------|-------|
| Supabase (Auth/PG/Storage/Realtime) | not provisioned | provisioned in [phase-04/05](05_IMPLEMENTATION_ROADMAP.md) |
| Redis | not provisioned | [phase-06](05_IMPLEMENTATION_ROADMAP.md) |
| OpenAI | not configured | [phase-14](05_IMPLEMENTATION_ROADMAP.md) |

## Change log

| Date | Change | By |
|------|--------|----|
| 2026-06-30 | Batch 1 documentation authored (docs 00–14, ADRs, templates) | CTO |
| 2026-06-30 | Batch 2 authored: implementation/ phases 01–36 (01–10 detailed, 11–36 scaffolds) | CTO |
| 2026-06-30 | Batch 3 authored: prompts/ phase-01..36 (one AI-coding prompt per phase) | CTO |
| 2026-06-30 | **Phase 01 implemented**: git init, Turborepo+pnpm monorepo, shared tsconfig/eslint-config (dep-direction guardrail + negative test), prettier/commitlint, CI workflow, placeholder packages (`@lifeos/contracts`, `@lifeos/config`, `@lifeos/api`). Full gate green (12/12 tasks). | CTO |

---

## Reading checklist for the next agent

1. Read [07 AI Agent Instructions](07_AI_AGENT_INSTRUCTIONS.md).
2. Confirm **Current/Next Phase** above.
3. Open that phase's `implementation/phase-NN-*.md` and `prompts/phase-NN.md`.
4. Implement **only** that phase. Do **not** touch frozen contracts or future phases.
5. Update **this file** before opening your PR.
