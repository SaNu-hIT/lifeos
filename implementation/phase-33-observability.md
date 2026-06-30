---
title: Phase 33 — Observability & Audit Logs
status: Scaffold
band: Optimization
phase: 33
depends_on: [16]
estimate: 4–5 days
---

# Phase 33 — Observability & Audit Logs

> Scaffold. Spec refs: [13 §5](../docs/13_DEPLOYMENT_GUIDE.md) · [11 §7](../docs/11_SECURITY_GUIDE.md).

## Overview
Add structured logging, distributed tracing, metrics, and analytics across the turn path (orchestrator → tools → connectors), plus surface the immutable Audit Log. Makes the system debuggable and cost-visible.

## Objectives & Scope
- Tracing with `requestId`/`turnId`; metrics (LLM latency/cost, queue depth, tool error rates).
- Structured, redacting logs; dashboards + alerts on error budgets/spend.
- Audit log surfacing + analytics event consumption (read-only).

## Dependencies
Phase-16 (turn path). Touches all engines.

## Acceptance Criteria (draft)
- [ ] A turn is traceable end-to-end; key metrics emitted.
- [ ] Sensitive actions audited; no PII in logs/metrics.

## Definition of Done (draft)
- [ ] Dashboards/alerts live; tests for redaction/audit green; [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-33.md](../prompts/phase-33.md).

## Known Risks
- Logging secrets/PII → redaction list + tests ([11 §4](../docs/11_SECURITY_GUIDE.md)).

## Future Extension Points
Anomaly detection on audit stream; CDC to warehouse; cost attribution per Skill/user.
