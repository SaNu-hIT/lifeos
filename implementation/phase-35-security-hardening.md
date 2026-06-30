---
title: Phase 35 — Security Hardening
status: Scaffold
band: Optimization
phase: 35
depends_on: []
estimate: 5–7 days
---

# Phase 35 — Security Hardening

> Scaffold. Spec refs: [11 Security Guide](../docs/11_SECURITY_GUIDE.md). Depends on the whole system being present.

## Overview
Execute a full security pass against the threat model: verify the three enforcement layers, audit RLS coverage, test prompt-injection containment, validate secrets handling, add rate/abuse controls, and run dependency/secret scanning. Re-reviewed per new sensitive-data Skill.

## Objectives & Scope
- Verify Permission Engine + Tool Registry validation + RLS independently enforce ([11 §2](../docs/11_SECURITY_GUIDE.md)).
- Prompt-injection tests: injected instructions cannot exceed user capabilities.
- Secrets audit; PII/data-classification review; field-level encryption for sensitive domains.
- Rate limits/abuse controls; CI security scanning gates.

## Dependencies
Effectively all phases.

## Acceptance Criteria (draft)
- [ ] Threat-model items each have a verified control.
- [ ] Injection containment proven; RLS coverage complete.
- [ ] No high-severity scanner findings.

## Definition of Done (draft)
- [ ] Security review signed off against [11](../docs/11_SECURITY_GUIDE.md); [06](../docs/06_PROJECT_STATE.md) updated.

## AI Coding Prompt
See [prompts/phase-35.md](../prompts/phase-35.md).

## Known Risks
- A single weak layer undermines defense-in-depth → test layers independently.

## Future Extension Points
Marketplace sandboxing; anomaly detection; compliance (GDPR/DPDP) data-subject flows.
