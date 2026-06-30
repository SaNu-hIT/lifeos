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
| **Current Phase** | _Phase 05 complete._ Ready to start Phase 06. |
| **Next Phase** | [phase-06 — Event Bus + Outbox + BullMQ](../implementation/phase-06-event-bus.md) ⚠️ needs Redis running |
| **Last completed phase** | 05 — Identity & Auth |
| **Contract version** (`@lifeos/contracts`) | `0.3.0` — adds `AuthUser` |
| **Database version** (latest migration) | `0004_audit_logs` (unchanged in phase 05) |
| **API version** | `v1` (`/v1/health`, `/v1/me`, `/v1/auth/session` live) |
| **Repo state** | Auth behind `AuthPort` with a local dev-JWT adapter (Supabase deferred); `AuthGuard` + `@CurrentUser`, user provisioning into `platform.users`, `userId`↔`auth.uid()` alignment proven. Full gate green (20 api tests). Branch `phase-01-foundation`. |
| **Last Updated** | 2026-06-30 |

## Completed phases

_None yet._ (When a phase completes, add a row: `| 01 | Foundation | 2026-… | PR #… | notes |`.)

| # | Phase | Date | PR | Notes |
|---|-------|------|----|----|
| 01 | Foundation & Monorepo | 2026-06-30 | (branch `phase-01-foundation`) | Turborepo+pnpm scaffold; dep-direction guardrail + negative test; CI; full gate green |
| 02 | Backend Bootstrap (NestJS) | 2026-06-30 | (branch `phase-01-foundation`) | NestJS app, `/v1` versioning, global ValidationPipe + exception filter (envelope), request-id ALS context, structured redacting logger, health module; contracts `0.1.0` frozen; 11 api tests + runtime boot verified |
| 03 | Platform Contracts | 2026-06-30 | (branch `phase-01-foundation`) | `Tool`, `UnifiedContext`, `SkillManifest`, `ProviderPort`, `CapabilityKey`, `DomainEvent`, `JSONSchema`, naming validators + `validateSkillManifest`; contract tests + export-surface backward-compat guard; contracts `0.2.0` |
| 04 | Database Foundation + RLS | 2026-06-30 | (branch `phase-01-foundation`) | Migrations 0001–0004 (schemas, users, outbox, audit_logs); `DatabasePort`+`PgDatabaseAdapter` (service/user contexts); migration runner + CLI; RLS cross-user denial test green; CI Postgres service added |
| 05 | Identity & Auth | 2026-06-30 | (branch `phase-01-foundation`) | `AuthPort` + dev-JWT adapter (Supabase deferred), `AuthGuard` + `@CurrentUser`, user provisioning (`platform.users`), `/v1/auth/session` (dev) + `/v1/me`; `userId`↔`auth.uid()` alignment test; contracts `0.3.0` (`AuthUser`) |

## Pending phases

Phases [06–36](05_IMPLEMENTATION_ROADMAP.md) are pending. Build order and dependencies: [05 Roadmap](05_IMPLEMENTATION_ROADMAP.md).

## Frozen public contracts

> Interfaces here are **frozen** — changing one requires an ADR + version bump + migration note. None exist yet; populate as `@lifeos/contracts` grows.

| Contract | Version | Defined in phase | Notes |
|----------|---------|------------------|-------|
| `ApiResponse<T>` / `ApiResponseMeta` | 0.1.0 | 02 | Standard success envelope |
| `ApiError` / `ApiErrorBody` | 0.1.0 | 02 | Standard error envelope |
| `LifeOSError` / `ErrorCodes` | 0.1.0 | 02 | Typed platform error + code enum |
| `AuthUser` | 0.3.0 | 05 | Authenticated principal (id == RLS auth.uid()) |
| `CapabilityKey` / `PermissionDecision` | 0.2.0 | 03 | Capability-based access primitives |
| `Tool` / `ToolResult` / `JSONSchema` | 0.2.0 | 03 | The unit the Planner calls |
| `UnifiedContext` / `ContextProvider` | 0.2.0 | 03 | The single data boundary for Skills |
| `ProviderPort` / `ProviderHealth` | 0.2.0 | 03 | Provider SDK base |
| `DomainEvent` / `EventHandler` | 0.2.0 | 03 | Event backbone primitives |
| `SkillManifest` (+ contributions) | 0.2.0 | 03 | Plugin manifest |
| naming validators / `validateSkillManifest` | 0.2.0 | 03 | Contract-level invariants |

A backward-compat guard ([export-surface.test.ts](../packages/contracts/src/export-surface.test.ts)) fails CI if a published export is removed/renamed.

## Architecture decisions in force

All accepted ADRs apply ([08](08_ARCHITECTURE_DECISIONS.md)): ADR-0001 … ADR-0010. None superseded.

## Known issues / open questions

| ID | Description | Severity | Phase | Status |
|----|-------------|----------|-------|--------|
| KI-001 | Test runner is **vitest**, but [12 Testing Guide](12_TESTING_GUIDE.md) names Jest. Chosen for first-class TS/ESM support and speed. Revisit: either adopt vitest in the Testing Guide (preferred) or migrate to Jest. | low | 01 | open |
| KI-002 | Dependency-direction guardrail currently enforces only the **core→Skill/Connector** boundary via `no-restricted-imports`. The finer domain→framework rule ([03 §3](03_LifeOS_Engineering_Handbook.md)) is added as the layered modules appear (phase-02+). | low | 01 | open |
| KI-003 | **Supabase deferred** (per user decision): phase 04 targets **local Postgres**. `auth.uid()` is emulated by a SQL function reading a per-txn GUC, and the adapter `SET ROLE lifeos_app` for user-context queries so RLS is enforced (mirrors Supabase's `authenticated` role). Schema is standard Postgres → transfers to Supabase unchanged. Real Supabase Auth/Storage/Realtime adapters land in phase 05 / deployment. | info | 04 | open |
| KI-004 | Primary keys use `gen_random_uuid()` (UUIDv4) instead of UUIDv7 named in [09](09_DATABASE_DESIGN.md) (no built-in v7 in PG16). Adopt a `uuidv7()` function/extension when available; affects sort-locality only. | low | 04 | open |
| KI-005 | **pgvector deferred to phase 12** (not installed locally). The `memory.embeddings` table + `vector` extension are created when the Memory Engine is built. | info | 04 | open |
| KI-006 | `@lifeos/api` now has **integration tests that require a running Postgres** (`LIFEOS_TEST_DATABASE_URL`, default `lifeos_test`). CI provisions a `postgres:16` service. Running `pnpm test` locally needs Postgres up. | info | 04 | open |

## Environment / external services

| Service | Status | Notes |
|---------|--------|-------|
| Postgres (local) | **running** | local PG16 on :5432; DBs `lifeos_dev`, `lifeos_test`; migrations applied. `auth.uid()` emulated (KI-003). |
| Supabase (Auth/Storage/Realtime) | not provisioned | deferred (KI-003); adapters in [phase-05](05_IMPLEMENTATION_ROADMAP.md) / deployment |
| Redis | not provisioned | [phase-06](05_IMPLEMENTATION_ROADMAP.md) |
| OpenAI | not configured | [phase-14](05_IMPLEMENTATION_ROADMAP.md) |

## Change log

| Date | Change | By |
|------|--------|----|
| 2026-06-30 | Batch 1 documentation authored (docs 00–14, ADRs, templates) | CTO |
| 2026-06-30 | Batch 2 authored: implementation/ phases 01–36 (01–10 detailed, 11–36 scaffolds) | CTO |
| 2026-06-30 | Batch 3 authored: prompts/ phase-01..36 (one AI-coding prompt per phase) | CTO |
| 2026-06-30 | **Phase 01 implemented**: git init, Turborepo+pnpm monorepo, shared tsconfig/eslint-config (dep-direction guardrail + negative test), prettier/commitlint, CI workflow, placeholder packages (`@lifeos/contracts`, `@lifeos/config`, `@lifeos/api`). Full gate green (12/12 tasks). | CTO |
| 2026-06-30 | **Phase 02 implemented**: NestJS bootstrap (`/v1` URI versioning), global ValidationPipe + `AllExceptionsFilter` (standard envelope), request-id ALS context + middleware, structured redacting logger, hexagonal health module, typed `@lifeos/config` loader (zod, fail-fast). Contracts `0.1.0` (envelopes + `LifeOSError`) frozen. Runtime boot + 11 api tests verified; full gate green. | CTO |
| 2026-06-30 | **Phase 03 implemented**: full platform contract surface in `@lifeos/contracts` 0.2.0 (`Tool`, `UnifiedContext`, `SkillManifest`, `ProviderPort`, `CapabilityKey`, `DomainEvent`, `JSONSchema`); naming validators + `validateSkillManifest`; contract tests (11) + export-surface backward-compat guard. Full gate green. | CTO |
| 2026-06-30 | **Phase 04 implemented** (local Postgres per user decision, KI-003): migrations 0001–0004 (schemas, users+RLS, outbox, audit_logs), `auth.uid()` emulation + `lifeos_app` role, `DatabasePort`+`PgDatabaseAdapter` (service/user contexts), forward-only migration runner + `migrate` CLI, `DatabaseModule`. Live RLS cross-user denial test + updated_at + outbox tests green (16 api tests). CI gains a postgres:16 service. DB version `0004`. | CTO |
| 2026-06-30 | **Phase 05 implemented**: `IdentityModule` — `AuthPort` + `DevAuthAdapter` (HS256 JWT, secret from config; Supabase adapter deferred), `AuthGuard` + `@CurrentUser`, `PgUserRepository` provisioning into `platform.users`, `ProvisionUserService`, `/v1/auth/session` (dev-only mint) + `/v1/me`. `userId` bound into request context; `userId`↔RLS `auth.uid()` alignment proven. Contracts `0.3.0` (`AuthUser`). Full gate green (20 api tests). | CTO |

---

## Reading checklist for the next agent

1. Read [07 AI Agent Instructions](07_AI_AGENT_INSTRUCTIONS.md).
2. Confirm **Current/Next Phase** above.
3. Open that phase's `implementation/phase-NN-*.md` and `prompts/phase-NN.md`.
4. Implement **only** that phase. Do **not** touch frozen contracts or future phases.
5. Update **this file** before opening your PR.
