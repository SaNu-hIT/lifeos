---
title: Phase 18 — Workflow Engine
status: Scaffold
band: Core
phase: 18
depends_on: [6, 17]
estimate: 6–7 days
---

# Phase 18 — Workflow Engine

> Scaffold. Spec refs: [02 §5](../docs/02_LifeOS_Platform_Architecture.md) · [workflow-template](../templates/workflow-template.md) · [ADR-0008](../docs/adr/adr-0008-event-driven-outbox.md).

## Overview
Execute multi-step, long-running, retryable plans durably and resumably. Steps call tools; non-idempotent steps have compensations; the engine survives restarts and supports human/async waits.

## Objectives & Scope
- Durable workflow state machine (persisted, resumable) on BullMQ.
- Step retries/backoff, idempotency, compensation/rollback, `await_*` steps.
- Drive execution of an `ExecutionPlan` (phase-17) when it needs durability.

## Key interfaces (to finalize)
```ts
export interface WorkflowEnginePort { start(def: WorkflowDef, input: unknown): Promise<WorkflowRun>; signal(runId: string, sig: Signal): Promise<void>; }
```

## Dependencies
Phase-06 (queue/events), phase-17 (plans).

## Acceptance Criteria (draft)
- [ ] Multi-step workflow runs, survives worker restart mid-run.
- [ ] Failure triggers compensation; retries respect idempotency.

## Definition of Done (draft)
- [ ] `WorkflowEnginePort` in contracts; resume/compensation tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-18.md](../prompts/phase-18.md).

## Known Risks
- Non-idempotent steps → enforce compensations; test crash-resume.

## Future Extension Points
Visual workflow inspector (Dev Console); scheduled/delayed steps; saga patterns across Skills.
