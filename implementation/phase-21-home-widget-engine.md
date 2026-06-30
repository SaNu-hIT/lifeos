---
title: Phase 21 — Home Widget Engine
status: Scaffold
band: Platform
phase: 21
depends_on: [10, 19]
estimate: 4–5 days
---

# Phase 21 — Home Widget Engine

> Scaffold. Spec refs: [02 §15](../docs/02_LifeOS_Platform_Architecture.md) · [widget-template](../templates/widget-template.md) · [04 §4](../docs/04_LifeOS_Product_Specification.md).

## Overview
Assemble the dynamic home from Skill-contributed widgets — capability-gated, priority/freshness-ranked, built from read models. Nothing hardcoded; enabling a Skill makes its widget eligible.

## Objectives & Scope
- Widget contribution registration (via Skill manifests, phase-10).
- Home assembly: capability filter → rank (priority/urgency/freshness) → render data.
- `/v1/home`; per-user widget read models (`surface.widget_instances`).

## Key interfaces (to finalize)
```ts
export interface HomeEnginePort { getHome(userId: string): Promise<HomeView>; }
```

## Dependencies
Phase-10 (widget contributions), phase-19 (read models/events).

## Acceptance Criteria (draft)
- [ ] Home assembles from contributions; hidden without capability.
- [ ] Ranking data-driven; no hardcoded layout.

## Definition of Done (draft)
- [ ] Contracts updated; tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-21.md](../prompts/phase-21.md).

## Known Risks
- Stale widgets → freshness TTL + graceful empty states.

## Future Extension Points
User-customizable ordering; A/B priority policies; richer widget types.
