---
title: LifeOS Master Index
status: Authoritative
version: 1.0.0
last_updated: 2026-06-30
owner: CTO / Chief Architect
audience: Everyone (humans + AI agents)
---

# 00 — LifeOS Master Index

> **This is the entry point to the LifeOS engineering operating manual.**
> If you are a human engineer, an AI coding agent (Claude Code, Cursor, Codex), or a reviewer, **start here**, then follow the reading order for your role. Every other document links back to this index.

LifeOS is an **AI-first Personal Operating System**. It is **not** a grocery app. Grocery is simply **Skill #1**. The platform must absorb unlimited future Skills (Fitness, Diet, Calendar, Travel, Finance, Medicines, Pets, Documents, Vehicles, Smart Home, …) **without architectural change**. Every document in this manual exists to make that possible and to **eliminate ambiguity** for the next 10 years.

---

## 1. How this manual is organized

```
docs/                      ← WHAT we are building and WHY (source of truth)
  00_MASTER_INDEX.md       ← you are here
  01_LifeOS_Vision.md
  02_LifeOS_Platform_Architecture.md      ← the keystone
  03_LifeOS_Engineering_Handbook.md
  04_LifeOS_Product_Specification.md
  05_IMPLEMENTATION_ROADMAP.md
  06_PROJECT_STATE.md      ← LIVE state — AI agents read this first, every session
  07_AI_AGENT_INSTRUCTIONS.md
  08_ARCHITECTURE_DECISIONS.md
  09_DATABASE_DESIGN.md
  10_API_STANDARD.md
  11_SECURITY_GUIDE.md
  12_TESTING_GUIDE.md
  13_DEPLOYMENT_GUIDE.md
  14_GLOSSARY.md
  adr/                     ← Architecture Decision Records (adr-0001 … )

implementation/            ← HOW we build it, phase by phase (≈36 phases)
  phase-01-foundation.md … phase-36-production.md

prompts/                   ← one AI-coding prompt per phase (drives the agents)
  phase-01.md … phase-36.md

templates/                 ← reusable scaffolds (skill, connector, module, …)
```

**The mental model:** `docs/` is the constitution. `implementation/` is the build sequence. `prompts/` is how an AI agent executes one step of that sequence. `templates/` keeps every new artifact consistent. `06_PROJECT_STATE.md` is the only living document — it changes after every phase.

---

## 2. Reading order by role

> Read **top-to-bottom** the first time. After that, jump via this index.

### 2.1 Human engineer (new joiner)
1. [01 — Vision](01_LifeOS_Vision.md) — why LifeOS exists, the principles, the 10-year bet.
2. [14 — Glossary](14_GLOSSARY.md) — learn the vocabulary before anything else drifts.
3. [02 — Platform Architecture](02_LifeOS_Platform_Architecture.md) — the keystone; read slowly.
4. [03 — Engineering Handbook](03_LifeOS_Engineering_Handbook.md) — how we write code here.
5. [08 — Architecture Decisions](08_ARCHITECTURE_DECISIONS.md) + [`adr/`](adr/) — why the big calls were made.
6. [09 — Database](09_DATABASE_DESIGN.md), [10 — API Standard](10_API_STANDARD.md).
7. [04 — Product Spec](04_LifeOS_Product_Specification.md), [05 — Roadmap](05_IMPLEMENTATION_ROADMAP.md).
8. [11 — Security](11_SECURITY_GUIDE.md), [12 — Testing](12_TESTING_GUIDE.md), [13 — Deployment](13_DEPLOYMENT_GUIDE.md).

### 2.2 AI coding agent (Claude Code / Cursor / Codex)
**Mandatory, every session, in this exact order:**
1. [07 — AI Agent Instructions](07_AI_AGENT_INSTRUCTIONS.md) — your operating rules.
2. [06 — PROJECT_STATE](06_PROJECT_STATE.md) — current phase, frozen contracts, known issues.
3. The single `implementation/phase-NN-*.md` you are assigned (and **only** that one).
4. The matching `prompts/phase-NN.md`.
5. As-needed references: [02](02_LifeOS_Platform_Architecture.md), [03](03_LifeOS_Engineering_Handbook.md), [09](09_DATABASE_DESIGN.md), [10](10_API_STANDARD.md), [14](14_GLOSSARY.md), and the relevant `templates/`.

> **Hard rule for agents:** never implement a future phase, never modify a frozen public contract. See [07](07_AI_AGENT_INSTRUCTIONS.md).

### 2.3 Reviewer / approver
1. [06 — PROJECT_STATE](06_PROJECT_STATE.md) — what was claimed done.
2. The assigned phase's **Definition of Done** + **Review Checklist** in `implementation/`.
3. [03 — Engineering Handbook](03_LifeOS_Engineering_Handbook.md) (standards), [12 — Testing](12_TESTING_GUIDE.md) (coverage), [11 — Security](11_SECURITY_GUIDE.md) (sensitive changes).

### 2.4 Product / founder
1. [01 — Vision](01_LifeOS_Vision.md) → [04 — Product Spec](04_LifeOS_Product_Specification.md) → [05 — Roadmap](05_IMPLEMENTATION_ROADMAP.md).

---

## 3. Document register

| ID | Document | Purpose | Status | Changes when… |
|----|----------|---------|--------|---------------|
| 00 | [Master Index](00_MASTER_INDEX.md) | Navigation + reading order | Authoritative | A new doc/section is added |
| 01 | [Vision](01_LifeOS_Vision.md) | Why LifeOS, principles, north star | Authoritative | Strategy shifts (rare) |
| 02 | [Platform Architecture](02_LifeOS_Platform_Architecture.md) | The system design (keystone) | Authoritative | An ADR changes a structure |
| 03 | [Engineering Handbook](03_LifeOS_Engineering_Handbook.md) | Coding standards & patterns | Authoritative | A convention is added/changed |
| 04 | [Product Specification](04_LifeOS_Product_Specification.md) | Product behavior & UX model | Authoritative | Product behavior changes |
| 05 | [Implementation Roadmap](05_IMPLEMENTATION_ROADMAP.md) | Phase sequence & dependencies | Authoritative | Phases are re-scoped |
| 06 | [Project State](06_PROJECT_STATE.md) | **Live** build state | Living | After **every** phase |
| 07 | [AI Agent Instructions](07_AI_AGENT_INSTRUCTIONS.md) | Rules for AI agents | Authoritative | Workflow rules change |
| 08 | [Architecture Decisions](08_ARCHITECTURE_DECISIONS.md) | ADR system + index | Authoritative | A new ADR is accepted |
| 09 | [Database Design](09_DATABASE_DESIGN.md) | Schema, RLS, migrations | Authoritative | A migration lands |
| 10 | [API Standard](10_API_STANDARD.md) | REST/realtime conventions | Authoritative | A convention changes |
| 11 | [Security Guide](11_SECURITY_GUIDE.md) | Threat model & controls | Authoritative | A control changes |
| 12 | [Testing Guide](12_TESTING_GUIDE.md) | Test strategy & gates | Authoritative | A test policy changes |
| 13 | [Deployment Guide](13_DEPLOYMENT_GUIDE.md) | Envs, CI/CD, scaling | Authoritative | Infra changes |
| 14 | [Glossary](14_GLOSSARY.md) | Canonical vocabulary | Authoritative | A term is added/renamed |

**Status legend:** `Authoritative` = source of truth, change via PR + review. `Living` = expected to change frequently (only 06). `Draft` = under construction, not yet binding. `Deprecated` = superseded; kept for history with a pointer to its replacement.

---

## 4. Core platform components → where they're documented

Every component named in the founding brief has exactly one architectural home (02), one owning implementation phase, and (where it produces code artifacts) a template. This table is the **conformance contract** — if a component is missing a column, the manual is incomplete.

| Component | Architecture | Phase | Template |
|-----------|--------------|-------|----------|
| AI Core (provider abstraction) | [02 §AI Core](02_LifeOS_Platform_Architecture.md) | [14](../implementation/phase-14-ai-provider.md) | — |
| Conversation Engine | 02 | 15 | — |
| Conversation Orchestrator | 02 | 16 | — |
| Planner | 02 | 17 | — |
| Workflow Engine | 02 | 18 | [workflow-template](../templates/workflow-template.md) |
| Context Engine | 02 | 13 | — |
| Memory Engine | 02 | 12 | — |
| Skill Registry | 02 | 10 | [skill-template](../templates/skill-template.md) |
| Tool Registry | 02 | 9 | — |
| Connector Registry / Provider SDK | 02 | 11 | [connector-template](../templates/connector-template.md) |
| Permission Engine | 02 | 7 | — |
| Subscription Engine | 02 | 8 | — |
| Notification Engine | 02 | 20 | [notification-template](../templates/notification-template.md) |
| Activity Engine | 02 | 19 | [activity-template](../templates/activity-template.md) |
| Home Widget Engine | 02 | 21 | [widget-template](../templates/widget-template.md) |
| Developer Console | 02 | 31 | — |
| Analytics | 02 | 33 | — |
| Settings | 02 | 5/13 | — |
| Audit Logs | 02 / [11](11_SECURITY_GUIDE.md) | 33 | — |

---

## 5. The 13 product principles (and where each is enforced)

These principles are non-negotiable. Each maps to a concrete mechanism — see [01](01_LifeOS_Vision.md) for the narrative and [02](02_LifeOS_Platform_Architecture.md)/[03](03_LifeOS_Engineering_Handbook.md) for enforcement.

| Principle | Enforced by |
|-----------|-------------|
| AI First | Conversation Orchestrator is the primary entry point (02 §Request Lifecycle) |
| Conversation First | Conversation Engine; UI is a thin renderer (04) |
| Skills over Features | Skill plugin model; no feature lives outside a Skill (02 §Skill System) |
| Platform over Product | Platform-first build order (05); Grocery is just a plugin |
| Plugin Architecture | Skill/Tool/Connector Registries + manifests (02, ADR-0001) |
| Everything is Context | Context Engine assembles Unified Context (02 §Context, ADR-0007) |
| Memory Driven | Memory Engine tiers + scoring (02 §Memory, ADR-0009) |
| Event Driven | Domain events + Outbox + BullMQ (02 §Events, ADR-0008) |
| Capability Based Permissions | Subscription→Capability→Permission→Tool→Skill (ADR-0006) |
| Configuration over Hardcoding | Config package + manifests; lint rule bans magic values (03) |
| Developer Experience First | Templates, SDKs, Dev Console, one-command setup (03, 13) |
| Scalable by Default | Modular monolith → services seam (ADR-0001), CQRS read models (ADR-0008) |
| Provider Agnostic | Provider SDK; Skills never know the provider (ADR-0005) |

---

## 6. Conventions every document follows

- **Front-matter** block (`title`, `status`, `version`, `last_updated`, `owner`, `audience`).
- **Cross-links** use relative paths (`02_LifeOS_Platform_Architecture.md`) so they work in any Markdown viewer and on GitHub.
- **Diagrams** use fenced ` ```mermaid ` blocks. Prefer a diagram over a paragraph when describing flow.
- **Decisions** are recorded as ADRs, never buried in prose. If you find a decision in prose, promote it to an ADR.
- **Vocabulary** comes from [14 — Glossary](14_GLOSSARY.md). If a term isn't there, add it before using it.
- **Examples** (JSON, interfaces, SQL) are illustrative unless a doc says "normative." Normative artifacts live in `packages/contracts` once code exists.

---

## 7. Change protocol

1. Propose the change in a PR that touches the relevant doc.
2. If it alters a structural decision → add/supersede an ADR (08) **in the same PR**.
3. If it changes the schema → update [09](09_DATABASE_DESIGN.md) + add a migration entry.
4. If it changes a public contract → bump the contract version and note it in [06](06_PROJECT_STATE.md).
5. Bump the document's `version` and `last_updated`.
6. Review per [07](07_AI_AGENT_INSTRUCTIONS.md) / your role.

---

## 8. Quick links

- 🧭 **Lost?** → this index.
- 🏗️ **Building right now?** → [06 PROJECT_STATE](06_PROJECT_STATE.md) + your phase file.
- 🤖 **An AI agent?** → [07 AI Agent Instructions](07_AI_AGENT_INSTRUCTIONS.md).
- ❓ **What does X mean?** → [14 Glossary](14_GLOSSARY.md).
- 🤔 **Why is it built this way?** → [08 ADRs](08_ARCHITECTURE_DECISIONS.md).

---

## Future Evolution

- This index will grow a **`skills/` registry table** as Skills ship (each Skill gets a one-line entry + manifest link).
- A **`marketplace/`** section will be added when third-party Skills/Connectors are supported (see [04 §Marketplace](04_LifeOS_Product_Specification.md)).
- When the monolith is split into services, a **`services/`** column will be added to the component table (§4) mapping each component to its owning service.
- Consider generating this index from front-matter automatically once the repo exists (a `docs:index` script in the monorepo).
