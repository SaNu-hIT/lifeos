---
title: Phase 34 — Performance & Caching
status: Scaffold
band: Optimization
phase: 34
depends_on: [13, 19]
estimate: 4–6 days
---

# Phase 34 — Performance & Caching

> Scaffold. Spec refs: [02 §17](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0008](../docs/adr/adr-0008-event-driven-outbox.md).

## Overview
Optimize the hot paths: context assembly + memory retrieval caching (Redis), read-model tuning for home/feed, plan caching for repeated intents, pgvector index tuning, and parallel tool execution by plan dependency graph.

## Objectives & Scope
- Redis caching for Unified Context and memory retrieval with correct invalidation.
- Plan cache for repeated intents; parallelize independent plan steps.
- Read-model/index tuning; load/soak tests against targets.

## Dependencies
Phase-13 (context), phase-19 (read models), phase-12/17/18.

## Acceptance Criteria (draft)
- [ ] Hot-path latency meets targets under load.
- [ ] Caches correct (no cross-permission leakage); invalidation tested.

## Definition of Done (draft)
- [ ] Load/soak tests meet targets; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-34.md](../prompts/phase-34.md).

## Known Risks
- Cache correctness vs permissions → never cache across permission boundaries; tested.

## Future Extension Points
Edge context caching; multi-region replicas; cost-aware LLM routing.
