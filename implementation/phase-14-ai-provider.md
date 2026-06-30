---
title: Phase 14 — AI Provider Abstraction (OpenAI)
status: Scaffold
band: Core
phase: 14
depends_on: [3]
estimate: 4–5 days
---

# Phase 14 — AI Provider Abstraction (OpenAI)

> Scaffold. Spec refs: [02 §7](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md).

## Overview
Build `@lifeos/ai-core`: a provider-agnostic LLM abstraction (`complete`, `embed`, `stream`) with an OpenAI adapter. Holds **no business logic**; only the Planner/Orchestrator/Memory call it. Skills never do.

## Objectives & Scope
- `AIProviderPort` with `complete`/`embed`/`stream`; OpenAI adapter.
- Cost/latency telemetry hooks; retry/timeout; structured tool-call support for the Planner.
- Config-driven model selection (no hardcoded model names — [03 §6](../docs/03_LifeOS_Engineering_Handbook.md)).

## Key interfaces (to finalize)
```ts
export interface AIProviderPort {
  complete(req: CompletionRequest): Promise<Completion>;
  stream(req: CompletionRequest): AsyncIterable<CompletionDelta>;
  embed(texts: string[]): Promise<number[][]>;
}
```

## Dependencies
Phase-03 (contracts). Consumed by phases 12, 16, 17.

## Acceptance Criteria (draft)
- [ ] `complete/embed/stream` work via OpenAI behind the port.
- [ ] No business logic in this package; Skills cannot import it (lint).
- [ ] Model/provider chosen by config; telemetry emitted.

## Definition of Done (draft)
- [ ] `AIProviderPort` in contracts; tests (mocked provider) green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-14.md](../prompts/phase-14.md).

## Known Risks
- Provider API drift → isolate in adapter; contract tests with recorded responses.
- Cost blowups → budgets/limits (phase-28/34).

## Future Extension Points
Claude/Gemini/OpenRouter/local adapters; cost/quality/latency **routing**; prompt/version management.
