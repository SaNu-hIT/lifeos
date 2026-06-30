---
title: AI Coding Prompt — Phase 08 (Subscription Engine)
status: Authoritative
phase: 8
type: prompt
---

# Prompt — Phase 08: Subscription Engine

> Paste this to an AI coding agent (Claude Code / Cursor / Codex) to implement **exactly one phase**. It is binding. The agent operates under [docs/07_AI_AGENT_INSTRUCTIONS.md](../docs/07_AI_AGENT_INSTRUCTIONS.md).

## Role
You are implementing **Phase 08 — Subscription Engine** of LifeOS, and nothing else.

## Step 0 — Read first (in order, do not skip)
1. [docs/07_AI_AGENT_INSTRUCTIONS.md](../docs/07_AI_AGENT_INSTRUCTIONS.md) — your binding rules.
2. [docs/06_PROJECT_STATE.md](../docs/06_PROJECT_STATE.md) — confirm Phase 08 is the current/next phase, read frozen contracts + known issues.
3. [implementation/phase-08-subscription-engine.md](../implementation/phase-08-subscription-engine.md) — the full spec for THIS phase. This phase's spec is FULLY DETAILED.
4. As needed: [docs/02_LifeOS_Platform_Architecture.md](../docs/02_LifeOS_Platform_Architecture.md), [docs/03_LifeOS_Engineering_Handbook.md](../docs/03_LifeOS_Engineering_Handbook.md), [docs/09_DATABASE_DESIGN.md](../docs/09_DATABASE_DESIGN.md), [docs/10_API_STANDARD.md](../docs/10_API_STANDARD.md), [docs/14_GLOSSARY.md](../docs/14_GLOSSARY.md), and the relevant files in [templates/](../templates/).

**Stop and ask a human if:** Phase 08 is not the current phase; a dependency from a later phase is missing; the work seems to require changing a **frozen contract**; or a real architectural choice (ADR-worthy) arises.

## Mission
Map plans→capabilities via data (`billing.plans`, `billing.plan_capabilities`, `billing.subscriptions`), materialize `capability_grants` on subscription/trial/admin/bundle changes, and stub a `BillingPort` PSP seam.

## Phase-specific guardrails
Subscriptions reference CAPABILITIES, never Skills. Grant materialization idempotent; invalidate the Permission cache (test it).

## Universal rules (always)
- Implement **only Phase 08**. Do **not** start, stub, or "prepare" any future phase.
- Do **not** modify any frozen public contract in `@lifeos/contracts` (see PROJECT_STATE). If you think you must, STOP and flag it.
- Keep business logic in Skills; the AI layer holds none ([ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md)).
- No core→Skill/Connector imports; no domain→framework imports; no Skill→DB cross-cutting query.
- Every tool is capability-gated; nothing hardcoded (providers, prices, capabilities, magic values).
- Build order within the phase: contracts → domain → application → adapters → wiring/tests.

## Deliverables
1. Code implementing this phase per its spec and [docs/03](../docs/03_LifeOS_Engineering_Handbook.md).
2. Tests to the coverage gate ([docs/12_TESTING_GUIDE.md](../docs/12_TESTING_GUIDE.md)): unit + contract (+ integration/E2E where the phase touches persistence/API). All green.
3. Documentation updates: the phase file (note any deviations), plus [docs/02](../docs/02_LifeOS_Platform_Architecture.md)/[09](../docs/09_DATABASE_DESIGN.md)/[10](../docs/10_API_STANDARD.md) if structure/schema/API changed; new terms → [docs/14_GLOSSARY.md](../docs/14_GLOSSARY.md); new decision → an ADR.
4. **Update [docs/06_PROJECT_STATE.md](../docs/06_PROJECT_STATE.md):** move Phase 08 to Completed, set next phase, bump contract/DB/API versions if changed, log known issues, append the change log, set Last Updated.
5. A PR titled `Phase 08 — Subscription Engine` with the phase **Review Checklist** ticked.

## Dependencies
Phase-07.

## Definition of Done
Use the agent checklist in [docs/07 §9](../docs/07_AI_AGENT_INSTRUCTIONS.md) **and** this phase's Definition of Done in [implementation/phase-08-subscription-engine.md](../implementation/phase-08-subscription-engine.md). The app must still build and work.

## After this phase
Next prompt: [prompts/phase-09.md](phase-09.md)
