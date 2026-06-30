---
title: Phase 24 — Grocery Context & Memory
status: Scaffold
band: Skills
phase: 24
depends_on: [23, 13]
estimate: 3–4 days
---

# Phase 24 — Grocery Context & Memory

> Scaffold. Spec refs: [02 §8/§9](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0007](../docs/adr/adr-0007-context-engine.md).

## Overview
Make Grocery personalized: contribute Grocery **Context Providers** (e.g. "the usual", low-stock) and write/read **memory** (preferred provider, dietary facts, usual items). Enables "order the usual" from [04 §3](../docs/04_LifeOS_Product_Specification.md).

## Objectives & Scope
- Grocery Context Providers feeding Unified Context (permission-filtered).
- Memory writes (preferences/facts) on relevant grocery events; retrieval into context.
- Personalized defaults in `grocery.build_cart` (strategy: usual).

## Dependencies
Phase-23 (domain/tools), phase-13 (context), phase-12 (memory).

## Acceptance Criteria (draft)
- [ ] "Order the usual" resolves from memory + context.
- [ ] Grocery sees only permitted context.
- [ ] Memory updates on grocery actions.

## Definition of Done (draft)
- [ ] Tests (context filter + personalization) green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-24.md](../prompts/phase-24.md).

## Known Risks
- Over-personalization/privacy → user-editable memory ([04 §7](../docs/04_LifeOS_Product_Specification.md)).

## Future Extension Points
Predictive restock; dietary-aware suggestions.
