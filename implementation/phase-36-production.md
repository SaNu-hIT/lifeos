---
title: Phase 36 — Production Readiness & Deployment
status: Scaffold
band: Production
phase: 36
depends_on: []
estimate: 5–7 days
---

# Phase 36 — Production Readiness & Deployment

> Scaffold. Spec refs: [13 Deployment Guide](../docs/13_DEPLOYMENT_GUIDE.md). The shippable milestone (M7).

## Overview
Make LifeOS production-ready: environments, CI/CD with gated migrations, blue-green/rolling deploys, health/readiness gating, runbooks, backups/DR, and SLOs/alerting. Closes the loop from local dev to live.

## Objectives & Scope
- `staging`/`production` environments; secrets via secret manager.
- CI/CD pipeline ([13 §3](../docs/13_DEPLOYMENT_GUIDE.md)) with migration gate + rollback strategy.
- Runbooks ([13 §8](../docs/13_DEPLOYMENT_GUIDE.md)); backups/DR; SLOs + alerts.

## Dependencies
All prior phases.

## Acceptance Criteria (draft)
- [ ] One-click promote to production with health-gated rollout + rollback.
- [ ] Runbooks exist for the key incidents; backups/DR verified.

## Definition of Done (draft)
- [ ] Production deploy succeeds; smoke/E2E green; [06](../docs/06_PROJECT_STATE.md) marks platform production-ready.

## AI Coding Prompt
See [prompts/phase-36.md](../prompts/phase-36.md).

## Known Risks
- Migration/deploy coupling → gated, forward-only migrations; rehearse rollback.

## Future Extension Points
Multi-region; service extraction track ([ADR-0001](../docs/adr/adr-0001-modular-monolith.md)); per-Skill deploy for marketplace.
