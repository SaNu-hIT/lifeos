---
title: Phase 28 — API Gateway & API Standard Hardening
status: Scaffold
band: Platform
phase: 28
depends_on: [16]
estimate: 4–5 days
---

# Phase 28 — API Gateway & API Standard Hardening

> Scaffold. Spec refs: [10 API Standard](../docs/10_API_STANDARD.md) · [api-template](../templates/api-template.md).

## Overview
Harden the public API surface for clients: consistent versioning, the BFF/gateway layer, OpenAPI generation, rate limiting + LLM cost budgets, idempotency, and pagination — making the API production-grade for web/mobile/console.

## Objectives & Scope
- Finalize `/v1` surface from [10 §7](../docs/10_API_STANDARD.md); generate OpenAPI from DTOs.
- Rate limits + per-capability cost budgets (Redis) at the gateway.
- Idempotency + keyset pagination enforced across endpoints.

## Dependencies
Phase-16 (turn API exists). Consumed by 30/31/32.

## Acceptance Criteria (draft)
- [ ] All endpoints conform to [10](../docs/10_API_STANDARD.md) (envelopes, versioning, errors).
- [ ] OpenAPI generated + backward-compat checked in CI.
- [ ] Rate limits + budgets enforced.

## Definition of Done (draft)
- [ ] Conformance tests green; [06](../docs/06_PROJECT_STATE.md) + API version updated.

## AI Coding Prompt
See [prompts/phase-28.md](../prompts/phase-28.md).

## Known Risks
- LLM cost abuse → budgets at gateway, not in Skills.

## Future Extension Points
GraphQL BFF; webhooks; third-party API keys/OAuth for the marketplace.
