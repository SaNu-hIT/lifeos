---
title: Phase 32 — Mobile App (Flutter)
status: Scaffold
band: UI
phase: 32
depends_on: [28, 29]
estimate: 8–10 days
---

# Phase 32 — Mobile App (Flutter)

> Scaffold. Spec refs: [04 Product Spec](../docs/04_LifeOS_Product_Specification.md).

## Overview
Build the Flutter mobile app: conversation (streaming), dynamic home, feed, notifications (push), settings. Mirrors the web app's behavior against the same platform API. UI renders state; no business logic.

## Objectives & Scope
- Auth, conversation + streaming, dynamic home, feed, push notifications, settings.
- Generated API client from OpenAPI; realtime via phase-29.
- Push registration with the Notification Engine (phase-20).

## Dependencies
Phase-28 (API), phase-29 (realtime), phase-20 (push).

## Acceptance Criteria (draft)
- [ ] Core flows work on iOS + Android; push delivered.
- [ ] Dynamic home parity with web.

## Definition of Done (draft)
- [ ] Widget/integration tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-32.md](../prompts/phase-32.md).

## Known Risks
- Platform-specific push/store quirks → isolate; test on both OSes.

## Future Extension Points
Voice, wearables, widgets/complications, offline.
