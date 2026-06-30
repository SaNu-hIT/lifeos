---
title: Phase 25 — Grocery Connectors (Blinkit/Zepto/Instamart)
status: Scaffold
band: Connectors
phase: 25
depends_on: [11, 23]
estimate: 5–7 days
---

# Phase 25 — Grocery Connectors

> Scaffold. Spec refs: [02 §12](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0005](../docs/adr/adr-0005-provider-sdk.md) · [connector-template](../templates/connector-template.md).

## Overview
Implement real grocery providers (Blinkit, Zepto, Instamart) as independent connectors behind `GroceryProviderPort`. The Connector Registry selects per request; Grocery never names a vendor. Each connector passes `runProviderContractTests`.

## Objectives & Scope
- One connector package per provider (client, mappers, scoped credentials, health).
- Selection policy (availability/price/preference/geo) + failover.
- Recorded fixtures for offline contract tests.

## Dependencies
Phase-11 (Provider SDK + registry), phase-23 (Grocery consumes the port).

## Acceptance Criteria (draft)
- [ ] Each connector passes `runProviderContractTests`.
- [ ] Registry selects/fails over; Grocery unchanged across providers.
- [ ] Credentials scoped; never exposed to the Skill/AI.

## Definition of Done (draft)
- [ ] Connectors registered + tested (fixtures committed); [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-25.md](../prompts/phase-25.md).

## Known Risks
- Vendor API instability → circuit breakers, failover, fixtures.
- Provider ToS/rate limits → respect limits in the client.

## Future Extension Points
More providers (BigBasket, Amazon Fresh); self-serve provider onboarding.
