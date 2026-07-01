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
| **Current Phase** | _Phase 11 complete — **M2 (plugin framework) done**._ Ready to start Phase 12. |
| **Next Phase** | [phase-12 — Memory Engine (pgvector)](../implementation/phase-12-memory-engine.md) ⚠️ needs pgvector (KI-005) |
| **Last completed phase** | 11 — Connector Registry & Provider SDK |
| **Contract version** (`@lifeos/contracts`) | `0.7.0` — adds `ConnectorRegistryPort` / `SelectionPolicy` |
| **Database version** (latest migration) | `0009_connectors` |
| **API version** | `v1` (`/v1/health`, `/v1/me`, `/v1/auth/session` live) |
| **Repo state** | **M2 complete — Tools + Skills + Connectors all pluggable.** `ConnectorRegistry` selects a provider per request by policy with health-based failover; `@lifeos/provider-sdk` (`defineConnector`, `runProviderContractTests`) + `@lifeos/connector-sample`. Skill contract-compat is now additive-within-major (see change log). Full gate green (49 api+pkg tests). Branch `phase-01-foundation`. |
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
| 06 | Event Bus + Outbox + BullMQ | 2026-06-30 | (branch `phase-01-foundation`) | Migration 0005 (`processed_events`); `EventBusPort`/`PgEventBus` (transactional outbox), `OutboxRelay`, BullMQ `EventQueue`/`EventWorker`, `SubscriberRegistry`+`DedupeStore`+`IdempotentDispatcher`, `EventsRuntime`; 4 event tests (atomicity, relay, idempotency, e2e); CI redis:7 service |
| 07 | Permission Engine | 2026-06-30 | (branch `phase-01-foundation`) | Migration 0006 (`catalog.capabilities`, `billing.capability_grants`); `PermissionPort`/`PgPermissionEngine` (deny-by-default, multi-source aggregation, expiry); shared `CacheModule` (Redis) + `AuditModule`; cache invalidation; denials audited; contracts `0.4.0`; 4 permission tests |
| 08 | Subscription Engine | 2026-06-30 | (branch `phase-01-foundation`) | Migration 0007 (`billing.plans`, `plan_capabilities` data-map, `subscriptions`); `SubscriptionService.changePlan/startTrial` materializes grants + invalidates permission cache; `BillingPort` DB stub; 3 tests (plan→grant→permission, trial expiry, idempotency). **M1 (platform spine) complete.** |
| 09 | Tool Registry | 2026-06-30 | (branch `phase-01-foundation`) | `ToolRegistryPort`/`ToolExecutionResult` (contracts `0.5.0`); `ToolRegistry` (validate→permit→confirm→execute→validate→audit), ajv `SchemaValidator`, HMAC confirmation tokens; capability gate via `PermissionPort`, executions audited; 7 unit tests |
| 10 | Skill Registry & Skill SDK | 2026-06-30 | (branch `phase-01-foundation`) | `SkillRegistryPort`/`SkillDescriptor` (contracts `0.6.0`); `@lifeos/skill-sdk` (`defineSkill`, `checkSkillContract`, `runSkillContractTests`); `SkillRegistry` (manifest register, semver contract-compat, forward tools→Tool Registry, persist, per-user enable/disable), migration 0008 (`catalog.skills`, `catalog.user_skills`); `@lifeos/skill-sample` reference Skill; core imports no Skill; 3 registry + 2 sample tests |
| 11 | Connector Registry & Provider SDK | 2026-06-30 | (branch `phase-01-foundation`) | `ConnectorRegistryPort`/`SelectionPolicy` (contracts `0.7.0`); `@lifeos/provider-sdk` (`defineConnector`, `runProviderContractTests`); `ConnectorRegistry` (register, select-by-policy w/ preferred + health failover + bulkhead, persist), migration 0009 (`catalog.connectors`); `@lifeos/connector-sample`; 6 registry + 1 sample tests. **M2 (plugin framework) complete.** |

## Pending phases

Phases [12–36](05_IMPLEMENTATION_ROADMAP.md) are pending. Build order and dependencies: [05 Roadmap](05_IMPLEMENTATION_ROADMAP.md). **M3 (AI brain: 12–18) next.**

## Frozen public contracts

> Interfaces here are **frozen** — changing one requires an ADR + version bump + migration note. None exist yet; populate as `@lifeos/contracts` grows.

| Contract | Version | Defined in phase | Notes |
|----------|---------|------------------|-------|
| `ApiResponse<T>` / `ApiResponseMeta` | 0.1.0 | 02 | Standard success envelope |
| `ApiError` / `ApiErrorBody` | 0.1.0 | 02 | Standard error envelope |
| `LifeOSError` / `ErrorCodes` | 0.1.0 | 02 | Typed platform error + code enum |
| `AuthUser` | 0.3.0 | 05 | Authenticated principal (id == RLS auth.uid()) |
| `CapabilityKey` / `PermissionDecision` | 0.2.0 | 03 | Capability-based access primitives |
| `PermissionPort` | 0.4.0 | 07 | Authorization boundary (can / capabilitiesFor) |
| `Tool` / `ToolResult` / `JSONSchema` | 0.2.0 | 03 | The unit the Planner calls |
| `ToolRegistryPort` / `ToolExecutionResult` | 0.5.0 | 09 | Tool execution safety boundary |
| `SkillRegistryPort` / `SkillDescriptor` | 0.6.0 | 10 | Skill registration boundary |
| `UnifiedContext` / `ContextProvider` | 0.2.0 | 03 | The single data boundary for Skills |
| `ProviderPort` / `ProviderHealth` | 0.2.0 | 03 | Provider SDK base |
| `ConnectorRegistryPort` / `SelectionPolicy` | 0.7.0 | 11 | Provider selection boundary |
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
| Redis (local) | **running** | local Redis on :6379; BullMQ events queue. CI uses a redis:7 service. |
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
| 2026-06-30 | **Phase 06 implemented**: `EventsModule` — transactional outbox (`EventBusPort`/`PgEventBus`, migration 0005 `processed_events`), `OutboxRelay`→BullMQ `EventQueue`/`EventWorker`, `SubscriberRegistry` + `DedupeStore` + `IdempotentDispatcher`, `EventsRuntime` (worker + relay loop; skipped under test for determinism). BullMQ owns its Redis connections (lazy; clean teardown). 4 event tests (atomic rollback, relay, idempotency, e2e via BullMQ). CI gains a redis:7 service. DB version `0005`. Full gate green (24 api tests). | CTO |
| 2026-06-30 | **Phase 07 implemented**: `PermissionModule` — `PermissionPort`/`PgPermissionEngine` (deny-by-default `can`, `capabilitiesFor`, multi-source aggregation, grant expiry), migration 0006 (`catalog.capabilities`, `billing.capability_grants`+RLS). New shared `CacheModule` (Redis, lazy, error-tolerant) and `AuditModule` (`AuditLog`). Capability set cached w/ invalidation; denials audited. Contracts `0.4.0`. DB version `0006`. Full gate green (28 api tests). | CTO |
| 2026-06-30 | **Phase 08 implemented** (M1 complete): `SubscriptionModule` — migration 0007 (`billing.plans`, `plan_capabilities` data-driven map, `subscriptions`+RLS); `SubscriptionService.changePlan/startTrial` materializes `capability_grants` (source-tagged) and invalidates the permission cache; `BillingPort` + DB-backed stub. Subscriptions reference capabilities, never Skills. 3 tests (plan→grant→permission, trial expiry, idempotency). DB version `0007`. Full gate green (31 api tests). | CTO |
| 2026-06-30 | **Phase 09 implemented** (M2 begins): `ToolRegistryModule` — `ToolRegistry` executes tools through the safety boundary (ajv input/output validation, capability gate via `PermissionPort`, HMAC `requiresConfirmation` tokens, audit). A malformed/unauthorized call never reaches a handler. Contracts `0.5.0` (`ToolRegistryPort`, `ToolExecutionResult`). ajv dep added. 7 unit tests. Full gate green (38 api tests). | CTO |
| 2026-06-30 | **Phase 10 implemented**: `SkillRegistryModule` — `SkillRegistry` registers Skills from manifests (core imports none; ADR-0001), semver `contractVersion` compat, forwards tools to the Tool Registry, persists a summary (migration 0008 `catalog.skills`/`user_skills`), per-user enable/disable. New `@lifeos/skill-sdk` (`defineSkill`/`runSkillContractTests`) + `@lifeos/skill-sample` reference Skill. Contracts `0.6.0` (`SkillRegistryPort`). semver dep added. DB version `0008`. Full gate green (43 api+skill tests). **LifeOS is now a platform.** | CTO |
| 2026-06-30 | **Phase 11 implemented** (M2 complete): `ConnectorRegistryModule` — `ConnectorRegistry` (register, `select(domain, {preferred})` with health-based failover + bulkhead for throwing providers, persist), migration 0009 (`catalog.connectors`). New `@lifeos/provider-sdk` (`defineConnector`/`runProviderContractTests`) + `@lifeos/connector-sample`. Contracts `0.7.0` (`ConnectorRegistryPort`). **Compat policy change:** Skill `contractVersion` compatibility is now **additive-within-major** (same major line + platform ≥ Skill floor via `semver.minVersion`), not strict caret — so additive minor bumps don't churn every Skill (consistent with the export-surface guard, docs/08). 6 registry + 1 sample tests. DB version `0009`. Full gate green (49 tests). | CTO |

---

## Reading checklist for the next agent

1. Read [07 AI Agent Instructions](07_AI_AGENT_INSTRUCTIONS.md).
2. Confirm **Current/Next Phase** above.
3. Open that phase's `implementation/phase-NN-*.md` and `prompts/phase-NN.md`.
4. Implement **only** that phase. Do **not** touch frozen contracts or future phases.
5. Update **this file** before opening your PR.
