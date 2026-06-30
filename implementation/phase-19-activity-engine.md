---
title: Phase 19 — Activity Engine
status: Scaffold
band: Platform
phase: 19
depends_on: [6]
estimate: 3–4 days
---

# Phase 19 — Activity Engine

> Scaffold. Spec refs: [02 §15](../docs/02_LifeOS_Platform_Architecture.md) · [activity-template](../templates/activity-template.md) · [ADR-0008](../docs/adr/adr-0008-event-driven-outbox.md).

## Overview
Build the append-only activity feed as a **CQRS read model** fed by domain events (idempotent projections). Powers the timeline and feeds the home screen.

## Objectives & Scope
- `surface.activities` (append-only) + projection registration.
- Idempotent event→activity projections; feed query (keyset paginated).
- `/v1/activities` endpoint.

## Key interfaces (to finalize)
```ts
export interface ActivityProjection { on: string; build(e: DomainEvent): ActivityEntry; idempotencyKey(e: DomainEvent): string; }
```

## Dependencies
Phase-06 (events). Consumed by phase-21 (home), phase-30/32 (UI).

## Acceptance Criteria (draft)
- [ ] Events project to the feed idempotently; feed paginates.
- [ ] Append-only enforced; no sensitive payloads.

## Definition of Done (draft)
- [ ] Projection API in contracts; tests green; [06](../docs/06_PROJECT_STATE.md) updated; DB version bumped.

## AI Coding Prompt
See [prompts/phase-19.md](../prompts/phase-19.md).

## Known Risks
- Duplicate projections → idempotency key tested.

## Future Extension Points
Activity grouping/threading; per-Skill filters; activity-driven analytics.
