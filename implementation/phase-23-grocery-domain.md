---
title: Phase 23 — Grocery Skill (Domain)
status: Scaffold
band: Skills
phase: 23
depends_on: [22]
estimate: 5–6 days
---

# Phase 23 — Grocery Skill (Domain)

> Scaffold. Spec refs: [04 §3 worked example](../docs/04_LifeOS_Product_Specification.md) · [skill-template](../templates/skill-template.md). **Skill #1 — the platform's first proof.**

## Overview
Build the Grocery Skill's domain and tools as an independent plugin: products, carts, orders, and the tools `grocery.search_products`, `grocery.build_cart`, `grocery.request_confirmation`, `grocery.place_order`. Uses Unified Context; provider calls go through ports (connectors in phase-25). No LLM calls; logic lives here ([ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md)).

## Objectives & Scope
- `grocery.*` schema (carts, orders, product prefs) + domain entities/invariants.
- Tools with capabilities (`grocery.read`, `grocery.order`) and confirmation on order placement.
- `GroceryProviderPort` consumed (impl in phase-25).

## Dependencies
Phase-22 (Skill framework ready).

## Acceptance Criteria (draft)
- [ ] Grocery registers via manifest; tools appear in the Tool Registry.
- [ ] Order placement requires confirmation + `grocery.order`.
- [ ] No cross-Skill imports; no direct DB for cross-cutting data; no LLM calls.
- [ ] `runSkillContractTests(grocery)` passes.

## Definition of Done (draft)
- [ ] Tools execute end-to-end (provider mocked); tests green; [06](../docs/06_PROJECT_STATE.md) updated; DB version bumped.

## AI Coding Prompt
See [prompts/phase-23.md](../prompts/phase-23.md).

## Known Risks
- Leaking platform assumptions from Grocery into core → review against [01 §2](../docs/01_LifeOS_Vision.md) ("never optimize for Grocery").

## Future Extension Points
More grocery tools (substitutions, schedules); reorder routines; phases 24–26 add memory, providers, surfaces.
