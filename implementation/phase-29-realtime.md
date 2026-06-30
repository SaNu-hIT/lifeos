---
title: Phase 29 — Realtime Layer
status: Scaffold
band: Platform
phase: 29
depends_on: [15]
estimate: 3–4 days
---

# Phase 29 — Realtime Layer

> Scaffold. Spec refs: [10 §8](../docs/10_API_STANDARD.md) · [ADR-0010](../docs/adr/adr-0010-supabase-baas.md) (Realtime behind a port).

## Overview
Stream assistant tokens, tool progress, and activity/notification pushes to clients via Supabase Realtime behind a `RealtimePort`. Every realtime update has a REST catch-up equivalent.

## Objectives & Scope
- `RealtimePort` + Supabase adapter; per-user/conversation authorized channels.
- Typed realtime envelopes (`assistant.delta`, `tool.progress`, `activity.new`).
- Streaming wired into the Orchestrator (phase-16) reply path.

## Dependencies
Phase-15 (conversations). Consumed by 30/32.

## Acceptance Criteria (draft)
- [ ] Assistant responses stream; channels authorized by capability.
- [ ] REST equivalent exists for catch-up.

## Definition of Done (draft)
- [ ] `RealtimePort` in contracts; tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-29.md](../prompts/phase-29.md).

## Known Risks
- Channel authorization gaps → capability checks tested.

## Future Extension Points
Self-host realtime gateway ([13 §7](../docs/13_DEPLOYMENT_GUIDE.md)); presence; collaborative sessions.
