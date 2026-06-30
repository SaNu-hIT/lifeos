---
title: Phase 17 — Planner
status: Scaffold
band: Core
phase: 17
depends_on: [14, 9, 16]
estimate: 5–6 days
---

# Phase 17 — Planner

> Scaffold. Spec refs: [02 §7](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md).

## Overview
Turn intent + Unified Context + available tools into a validated **Execution Plan** (ordered, dependency-aware tool calls). The Planner **only generates plans**; it never executes or mutates state. Plans are validated against the Tool Registry before execution.

## Objectives & Scope
- Plan generation using AI Core (tool-aware) constrained to registered tools.
- `ExecutionPlan` schema with steps, `dependsOn`, and `requiresUserConfirmation`.
- Pre-execution validation: every tool call valid against Tool Registry schemas; invalid plans rejected.

## Key interfaces (to finalize)
```ts
export interface PlannerPort { plan(input: PlanInput): Promise<ExecutionPlan>; }
export interface ExecutionPlan { planId: string; intent: string; steps: PlanStep[]; requiresUserConfirmation: boolean; }
```

## Dependencies
Phase-14 (AI), phase-9 (tools for validation), phase-16 (consumer).

## Acceptance Criteria (draft)
- [ ] Produces valid `ExecutionPlan`s constrained to registered tools.
- [ ] Invalid/unknown tool calls rejected before execution.
- [ ] No execution/side effects in the Planner.

## Definition of Done (draft)
- [ ] `PlannerPort`/`ExecutionPlan` in contracts; plan-validation tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-17.md](../prompts/phase-17.md).

## Known Risks
- LLM produces invalid plans → strict validation + repair loop; tests assert structure not prose ([12 §3](../docs/12_TESTING_GUIDE.md)).

## Future Extension Points
Plan caching for repeated intents; cost-aware model selection; multi-Skill plan optimization.
