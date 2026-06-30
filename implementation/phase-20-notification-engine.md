---
title: Phase 20 — Notification Engine
status: Scaffold
band: Platform
phase: 20
depends_on: [6]
estimate: 4–5 days
---

# Phase 20 — Notification Engine

> Scaffold. Spec refs: [02 §15](../docs/02_LifeOS_Platform_Architecture.md) · [notification-template](../templates/notification-template.md) · [04 §6](../docs/04_LifeOS_Product_Specification.md).

## Overview
Deliver multi-channel notifications (push/in-app/email) from declared intents. Skills **declare**; the engine chooses channel, templates, batches, respects quiet hours, and delivers. Triggered by domain events.

## Objectives & Scope
- Notification declarations + channel adapters behind ports.
- Policy: user prefs, quiet hours, batching, importance, dedupe.
- `surface.notifications` persistence; `/v1/notifications`.

## Key interfaces (to finalize)
```ts
export interface NotificationEnginePort { deliver(decl: NotificationDeclaration, e: DomainEvent): Promise<void>; }
```

## Dependencies
Phase-06 (events). Consumed by phase-26.

## Acceptance Criteria (draft)
- [ ] Declared notification delivers via correct channels honoring prefs/quiet hours.
- [ ] Idempotent; no duplicates on event replay.

## Definition of Done (draft)
- [ ] Contracts updated; tests green; [06](../docs/06_PROJECT_STATE.md) updated; DB version bumped.

## AI Coding Prompt
See [prompts/phase-20.md](../prompts/phase-20.md).

## Known Risks
- Notification spam → batching + importance + quiet hours tested.

## Future Extension Points
SMS/WhatsApp/wearables; send-time optimization; smart bundling.
