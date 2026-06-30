---
title: Phase 13 — Context Engine
status: Scaffold
band: Core
phase: 13
depends_on: [7, 12]
estimate: 5–6 days
---

# Phase 13 — Context Engine

> Scaffold. Spec refs: [02 §8](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0007](../docs/adr/adr-0007-context-engine.md).

## Overview
Assemble the permission-filtered **Unified Context** (DB + Memory + Conversation + Settings + Permissions) passed to every tool handler. Compose Skill **Context Providers**; cache per (user, scope). This is the single sanctioned data boundary for Skills.

## Objectives & Scope
- `ContextEngine.assemble(user, conversation, scope)` → `UnifiedContext`.
- Compose registered Context Providers (from Skills, phase-10/22).
- Permission filtering via Permission Engine (phase-07).
- Redis caching with TTL + invalidation on memory/settings change.

## Key interfaces (to finalize)
```ts
export interface ContextEnginePort { assemble(input: ContextRequest): Promise<UnifiedContext>; }
export interface ContextProvider { scope: string; contribute(req: ContextRequest): Promise<Partial<UnifiedContext>>; }
```

## Dependencies
Phase-07 (permission filtering), phase-12 (memory). Consumed by phase-16.

## Acceptance Criteria (draft)
- [ ] Produces a typed, permission-filtered `UnifiedContext`.
- [ ] Skills receive context; no Skill queries cross-cutting data directly.
- [ ] Cached with correct invalidation.

## Definition of Done (draft)
- [ ] `ContextEnginePort` in contracts; tests (incl. permission-filter) green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-13.md](../prompts/phase-13.md).

## Known Risks
- Hot path → cache, but never cache across permission boundaries incorrectly.
- Provider misbehavior → timeouts/fallbacks; partial context tolerated.

## Future Extension Points
Streaming/partial context; edge/precomputed context; richer personalization signals.
