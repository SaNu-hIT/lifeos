---
title: AI Coding Prompt — Phase 14 (AI Provider Abstraction (OpenAI))
status: Authoritative
phase: 14
type: prompt
---

# Prompt — Phase 14: AI Provider Abstraction (OpenAI)

> Paste this to an AI coding agent (Claude Code / Cursor / Codex) to implement **exactly one phase**. It is binding. The agent operates under [docs/07_AI_AGENT_INSTRUCTIONS.md](../docs/07_AI_AGENT_INSTRUCTIONS.md).

## Role
You are implementing **Phase 14 — AI Provider Abstraction (OpenAI)** of LifeOS, and nothing else.

## Step 0 — Read first (in order, do not skip)
1. [docs/07_AI_AGENT_INSTRUCTIONS.md](../docs/07_AI_AGENT_INSTRUCTIONS.md) — your binding rules.
2. [docs/06_PROJECT_STATE.md](../docs/06_PROJECT_STATE.md) — confirm Phase 14 is the current/next phase, read frozen contracts + known issues.
3. [implementation/phase-14-ai-provider.md](../implementation/phase-14-ai-provider.md) — the full spec for THIS phase. This phase's spec is currently a SCAFFOLD — before coding, expand it to the full 17-section structure (use phase-01 as the model) and get it reviewed.
4. As needed: [docs/02_LifeOS_Platform_Architecture.md](../docs/02_LifeOS_Platform_Architecture.md), [docs/03_LifeOS_Engineering_Handbook.md](../docs/03_LifeOS_Engineering_Handbook.md), [docs/09_DATABASE_DESIGN.md](../docs/09_DATABASE_DESIGN.md), [docs/10_API_STANDARD.md](../docs/10_API_STANDARD.md), [docs/14_GLOSSARY.md](../docs/14_GLOSSARY.md), and the relevant files in [templates/](../templates/).

**Stop and ask a human if:** Phase 14 is not the current phase; a dependency from a later phase is missing; the work seems to require changing a **frozen contract**; or a real architectural choice (ADR-worthy) arises.

## Mission
Build `@lifeos/ai-core`: `AIProviderPort` (`complete`/`embed`/`stream`) with an OpenAI adapter, tool-call support for the Planner, retries/timeouts, cost/latency telemetry, and config-driven model selection.

## Phase-specific guardrails
ZERO business logic in this package. Skills cannot import it (lint). No hardcoded model names — config only.

## Universal rules (always)
- Implement **only Phase 14**. Do **not** start, stub, or "prepare" any future phase.
- Do **not** modify any frozen public contract in `@lifeos/contracts` (see PROJECT_STATE). If you think you must, STOP and flag it.
- Keep business logic in Skills; the AI layer holds none ([ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md)).
- No core→Skill/Connector imports; no domain→framework imports; no Skill→DB cross-cutting query.
- Every tool is capability-gated; nothing hardcoded (providers, prices, capabilities, magic values).
- Build order within the phase: contracts → domain → application → adapters → wiring/tests.

## Deliverables
1. Code implementing this phase per its spec and [docs/03](../docs/03_LifeOS_Engineering_Handbook.md).
2. Tests to the coverage gate ([docs/12_TESTING_GUIDE.md](../docs/12_TESTING_GUIDE.md)): unit + contract (+ integration/E2E where the phase touches persistence/API). All green.
3. Documentation updates: the phase file (note any deviations), plus [docs/02](../docs/02_LifeOS_Platform_Architecture.md)/[09](../docs/09_DATABASE_DESIGN.md)/[10](../docs/10_API_STANDARD.md) if structure/schema/API changed; new terms → [docs/14_GLOSSARY.md](../docs/14_GLOSSARY.md); new decision → an ADR.
4. **Update [docs/06_PROJECT_STATE.md](../docs/06_PROJECT_STATE.md):** move Phase 14 to Completed, set next phase, bump contract/DB/API versions if changed, log known issues, append the change log, set Last Updated.
5. A PR titled `Phase 14 — AI Provider Abstraction (OpenAI)` with the phase **Review Checklist** ticked.

## Dependencies
Phase-03.

## Definition of Done
Use the agent checklist in [docs/07 §9](../docs/07_AI_AGENT_INSTRUCTIONS.md) **and** this phase's Definition of Done in [implementation/phase-14-ai-provider.md](../implementation/phase-14-ai-provider.md). The app must still build and work.

## After this phase
Next prompt: [prompts/phase-15.md](phase-15.md)
