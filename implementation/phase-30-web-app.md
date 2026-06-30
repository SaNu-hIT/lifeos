---
title: Phase 30 — Web App (Next.js)
status: Scaffold
band: UI
phase: 30
depends_on: [28, 29]
estimate: 7–9 days
---

# Phase 30 — Web App (Next.js)

> Scaffold. Spec refs: [04 Product Spec](../docs/04_LifeOS_Product_Specification.md). Conversation-first UI; UI renders platform state, holds no business logic.

## Overview
Build the Next.js user app: conversation (streaming), dynamic home (widgets), activity feed, notifications, settings. Types generated from the API's OpenAPI (phase-28); realtime via phase-29.

## Objectives & Scope
- Auth, conversation UI with streaming + confirmation flow, dynamic home, feed, settings.
- Generated API client; `@lifeos/ui` shared components.
- No business logic in the client (it calls platform endpoints).

## Dependencies
Phase-28 (API), phase-29 (realtime).

## Acceptance Criteria (draft)
- [ ] User can converse, see streamed replies, confirm actions, view home/feed.
- [ ] Home is dynamic (widgets from enabled Skills); nothing hardcoded.

## Definition of Done (draft)
- [ ] E2E (Playwright) green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-30.md](../prompts/phase-30.md).

## Known Risks
- Business logic creeping into the client → keep it a renderer of platform state.

## Future Extension Points
Voice input; offline; PWA; richer widget rendering.
