---
title: Phase 31 — Developer Console
status: Scaffold
band: UI
phase: 31
depends_on: [28]
estimate: 5–6 days
---

# Phase 31 — Developer Console

> Scaffold. Spec refs: [02 §5](../docs/02_LifeOS_Platform_Architecture.md). The DX surface — "Developer Experience First."

## Overview
Build the Next.js console for inspecting and managing the platform: registered Skills/Tools/Connectors, capabilities, a turn inspector (intent → context → plan → tool results), and memory/context viewers. Critical for building and debugging Skills.

## Objectives & Scope
- Registry browsers (Skills/Tools/Connectors/Capabilities) — gated.
- Turn inspector: see the Execution Plan, tool I/O, permission decisions, events.
- Memory & Unified Context viewers (read-only, permission-respecting).

## Dependencies
Phase-28 (API). Reads from registries (9/10/11), planner (17), permission (7), memory (12), context (13).

## Acceptance Criteria (draft)
- [ ] Console lists registries and inspects a turn end-to-end.
- [ ] Access gated; no sensitive data leaked.

## Definition of Done (draft)
- [ ] Tests green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-31.md](../prompts/phase-31.md).

## Known Risks
- Exposing sensitive data → respect permissions/redaction ([11](../docs/11_SECURITY_GUIDE.md)).

## Future Extension Points
Skill scaffolding (`lifeos new`), marketplace publishing, workflow inspector, eval dashboards.
