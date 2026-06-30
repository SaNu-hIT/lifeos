---
title: Phase 16 — Conversation Orchestrator
status: Scaffold
band: Core
phase: 16
depends_on: [13, 14, 15, 9]
estimate: 6–8 days
---

# Phase 16 — Conversation Orchestrator

> Scaffold. Spec refs: [02 §6 Request Lifecycle](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md). The brain stem — the canonical turn loop.

## Overview
Drive one turn end-to-end: understand (AI) → assemble Context (phase-13) → plan (Planner, phase-17) → execute tools (Tool Registry, phase-9) → write memory → summarize (AI) → persist reply. Holds **no business logic** — it sequences engines.

## Objectives & Scope
- The turn loop from [02 §6](../docs/02_LifeOS_Platform_Architecture.md), incl. confirmation handling and event emission.
- Memory writes at end of turn (facts/prefs/summary).
- Streaming reply via Conversation Engine / realtime (phase-29).

## Key interfaces (to finalize)
```ts
export interface OrchestratorPort { handleTurn(input: TurnInput): Promise<TurnResult>; }
```

## Dependencies
Phases 13, 14, 15, 9 (and 17 for planning — integrate iteratively).

## Acceptance Criteria (draft)
- [ ] A user message produces a planned, permission-checked, executed, summarized reply.
- [ ] Confirmation flow works; events emitted; memory updated.
- [ ] No business logic in the orchestrator.

## Definition of Done (draft)
- [ ] `OrchestratorPort` in contracts; E2E turn test green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-16.md](../prompts/phase-16.md).

## Known Risks
- LLM latency → streaming, plan caching (phase-34).
- Scope creep into business logic → keep it an orchestrator; logic stays in Skills.

## Future Extension Points
Multi-Skill plan composition; proactive (event-triggered) turns; multi-LLM routing.
