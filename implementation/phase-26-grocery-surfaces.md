---
title: Phase 26 — Grocery Widgets/Activities/Notifications
status: Scaffold
band: Skills
phase: 26
depends_on: [23, 19, 20, 21]
estimate: 3–4 days
---

# Phase 26 — Grocery Surfaces (Widgets/Activities/Notifications)

> Scaffold. Templates: [widget](../templates/widget-template.md) · [activity](../templates/activity-template.md) · [notification](../templates/notification-template.md).

## Overview
Complete Grocery's user surface: a low-stock/reorder home **widget**, **activities** (order placed/delivered), and **notifications** (dispatched/ETA). All via declarations through the platform engines — no direct channel/home code in the Skill.

## Objectives & Scope
- Grocery widget contribution (capability-gated, deep-links to a reorder turn).
- Activity projections for grocery events.
- Notification declarations for dispatch/delivery.

## Dependencies
Phase-23 (Grocery), 19 (activities), 20 (notifications), 21 (home).

## Acceptance Criteria (draft)
- [ ] Grocery widget appears when enabled + capability held.
- [ ] Order events produce activities and notifications (idempotent).

## Definition of Done (draft)
- [ ] Surfaces verified end-to-end; tests green; [06](../docs/06_PROJECT_STATE.md) updated. **Grocery is now a complete Skill (M4).**

## AI Coding Prompt
See [prompts/phase-26.md](../prompts/phase-26.md).

## Known Risks
- Notification noise → respect batching/quiet hours.

## Future Extension Points
Richer widgets; delivery tracking; proactive restock reminders.
