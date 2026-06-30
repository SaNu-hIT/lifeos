---
title: Phase 27 — Second Skill (Calendar)
status: Scaffold
band: Skills
phase: 27
depends_on: [22]
estimate: 5–6 days
---

# Phase 27 — Second Skill (Calendar)

> Scaffold. The **extensibility proof (M5)**: a second, unrelated Skill built with **zero platform change**.

## Overview
Build a Calendar Skill independently of Grocery to validate that the platform truly hosts arbitrary Skills. Demonstrates cross-Skill cooperation via events (e.g. Grocery delivery → Calendar reminder) without any direct coupling.

## Objectives & Scope
- Calendar domain + tools (`calendar.create_event`, `calendar.find_time`, …) with capabilities.
- A calendar provider port + at least one connector (or native store) via the Provider SDK.
- Cross-Skill event cooperation demo (events only — no Skill→Skill imports).

## Dependencies
Phase-22 (framework). **Must not modify platform core or Grocery.**

## Acceptance Criteria (draft)
- [ ] Calendar Skill ships **without changing platform code or other Skills**.
- [ ] Calendar tools work end-to-end; `runSkillContractTests(calendar)` passes.
- [ ] A cross-Skill scenario works purely via events.

## Definition of Done (draft)
- [ ] Acceptance Criteria met; tests green; [06](../docs/06_PROJECT_STATE.md) updated. **If any core change was needed, that's a platform defect to fix — record it.**

## AI Coding Prompt
See [prompts/phase-27.md](../prompts/phase-27.md).

## Known Risks
- Discovering the platform *did* need changes → that's the point; fix the platform, not the Skill, and note the gap.

## Future Extension Points
The remaining Skill catalog (Fitness, Finance, Travel…) each becomes a phase-like unit on this proven pattern.
