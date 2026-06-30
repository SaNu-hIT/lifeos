---
title: Phase 22 — Skill Framework Finalization
status: Scaffold
band: Framework
phase: 22
depends_on: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
estimate: 4–5 days
---

# Phase 22 — Skill Framework Finalization

> Scaffold. Spec refs: [02 §10](../docs/02_LifeOS_Platform_Architecture.md) · [skill-template](../templates/skill-template.md).

## Overview
Complete the Skill SDK so a Skill can use **all** platform engines through clean SDK surfaces: tools, context providers, widgets, activities, notifications, event handlers, and config. This is the readiness gate before building real Skills. After this phase, the [skill-template](../templates/skill-template.md) is fully buildable end-to-end.

## Objectives & Scope
- Wire manifest contributions (widgets→21, activities→19, notifications→20, event handlers→6) through the Skill Registry.
- Finalize `@lifeos/skill-sdk` base classes + `runSkillContractTests` coverage of all contribution types.
- A reference "kitchen-sink" sample Skill exercising every surface (test-only).

## Dependencies
Phases 10–21.

## Acceptance Criteria (draft)
- [ ] A Skill can register tools, context providers, widgets, activities, notifications, and event handlers via its manifest.
- [ ] `runSkillContractTests` validates all contribution types.
- [ ] Sample Skill exercises every surface end-to-end.

## Definition of Done (draft)
- [ ] SDK finalized; contract tests green; [06](../docs/06_PROJECT_STATE.md) updated; [skill-template](../templates/skill-template.md) confirmed accurate.

## AI Coding Prompt
See [prompts/phase-22.md](../prompts/phase-22.md).

## Known Risks
- Hidden coupling discovered late → the kitchen-sink Skill surfaces gaps before real Skills.

## Future Extension Points
Marketplace packaging hooks; Skill dependency declarations; hot reload.
