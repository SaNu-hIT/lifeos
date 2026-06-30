---
title: LifeOS Glossary
status: Authoritative
version: 1.0.0
last_updated: 2026-06-30
owner: Chief Architect
audience: Everyone
---

# 14 — Glossary

> The canonical vocabulary of LifeOS. **If a term isn't here, add it before using it.** Consistent language is how a large team and many AI agents avoid drift. Terms are grouped; each links to where it's defined in depth.

Related: [00 Index](00_MASTER_INDEX.md) · [02 Architecture](02_LifeOS_Platform_Architecture.md)

---

## Platform & product

- **LifeOS** — An AI-first Personal Operating System; a conversational platform hosting many **Skills**. Not a grocery app. ([01](01_LifeOS_Vision.md))
- **Skill** — A self-contained capability plugin (Grocery, Calendar, …) that owns its business logic, tools, context providers, widgets, activities, notifications, permissions, and config. Independent of all other Skills. ([02 §10](02_LifeOS_Platform_Architecture.md))
- **Platform Core** — The engines and services Skills run on; never imports a Skill. ([02 §5](02_LifeOS_Platform_Architecture.md))
- **Provider** — An external service a Connector talks to (Blinkit, Zepto, OpenAI). Skills never name a provider. ([ADR-0005](adr/adr-0005-provider-sdk.md))
- **Marketplace** — Future surface for third-party Skills/Connectors. ([04 §8](04_LifeOS_Product_Specification.md))

## AI & conversation

- **AI Core** — Abstraction over LLM providers (`complete`, `embed`, `stream`). Holds no business logic. ([02 §7](02_LifeOS_Platform_Architecture.md), [ADR-0004](adr/adr-0004-ai-no-business-logic.md))
- **Conversation Engine** — Owns conversations, messages, turns, streaming. ([02 §5](02_LifeOS_Platform_Architecture.md))
- **Conversation Orchestrator** — Drives one turn: understand → context → plan → execute → summarize. ([02 §6](02_LifeOS_Platform_Architecture.md))
- **Planner** — Produces an **Execution Plan** from intent + context; never executes. ([02 §7](02_LifeOS_Platform_Architecture.md))
- **Execution Plan** — An ordered, dependency-aware set of validated **tool** calls. ([02 §7](02_LifeOS_Platform_Architecture.md))
- **Workflow Engine** — Executes multi-step/long-running plans durably and idempotently. ([02 §5](02_LifeOS_Platform_Architecture.md))
- **Turn** — One user message and the system's full response cycle. ([04 §2](04_LifeOS_Product_Specification.md))
- **Intent** — The understood goal of a user message.

## Context & memory

- **Context Engine** — Assembles **Unified Context** from DB + Memory + Conversation + Settings + Permissions; the only sanctioned data boundary for Skills. ([ADR-0007](adr/adr-0007-context-engine.md))
- **Unified Context** — The typed object passed to every tool handler; permission-filtered. ([02 §8](02_LifeOS_Platform_Architecture.md))
- **Context Provider** — A Skill-owned contributor of domain data into context assembly.
- **Memory Engine** — Stores/retrieves/scores/expires memory. ([02 §9](02_LifeOS_Platform_Architecture.md), [ADR-0009](adr/adr-0009-pgvector-memory.md))
- **Short-Term Memory** — Ephemeral working memory for the current task (Redis).
- **Conversation Memory** — Rolling per-conversation summaries.
- **Long-Term Memory** — Durable **Facts** + **Preferences**.
- **Fact** — A durable statement about the user ("is vegetarian").
- **Preference** — A keyed user choice ("preferred grocery provider = Zepto").
- **Summary** — A condensed record of a conversation/period.
- **Embedding** — A vector representation for semantic retrieval (pgvector).
- **Memory Score** — `relevance × recency × importance`; ranks retrieval.

## Plugin framework

- **Skill Registry** — Registers Skills from manifests; lifecycle/versioning. ([02 §10](02_LifeOS_Platform_Architecture.md))
- **Skill Manifest** — Declarative description a Skill registers with (tools, widgets, capabilities, config schema, version).
- **Tool** — The unit the Planner can call; namespaced (`grocery.build_cart`), schema-validated, capability-gated. ([02 §11](02_LifeOS_Platform_Architecture.md))
- **Tool Registry** — Registers/validates/executes tools. ([02 §11](02_LifeOS_Platform_Architecture.md))
- **Connector** — An adapter implementing a **Provider SDK** port for one provider. ([02 §12](02_LifeOS_Platform_Architecture.md))
- **Connector Registry** — Registers connectors and selects one per request by policy.
- **Provider SDK** — Domain-shaped interfaces (ports) connectors implement. ([ADR-0005](adr/adr-0005-provider-sdk.md))
- **Skill SDK** — Base classes, manifest types, and contract-test kit for building Skills.

## Permissions & monetization

- **Capability** — A fine-grained unit of what a user may do (`grocery.order`). The currency of access. ([ADR-0006](adr/adr-0006-capability-permissions.md))
- **Permission** — A resolved allow/deny for (user, capability, scope). ([02 §13](02_LifeOS_Platform_Architecture.md))
- **Permission Engine** — Evaluates capability checks and filters Context.
- **Subscription** — A billing relationship that **grants capabilities** (never unlocks Skills directly). ([ADR-0006](adr/adr-0006-capability-permissions.md))
- **Capability Grant** — A resolved grant of a capability from a subscription/trial/admin/bundle.
- **Subscription Engine** — Maps plans → capabilities. ([02 §13](02_LifeOS_Platform_Architecture.md))

## Events & surfaces

- **Domain Event** — A past-tense fact emitted by a use case (`grocery.order_placed`). ([02 §14](02_LifeOS_Platform_Architecture.md))
- **Outbox** — A table written in the same transaction as state, then relayed to the queue (reliable events). ([ADR-0008](adr/adr-0008-event-driven-outbox.md))
- **CQRS** — Separating command (write) from query (read) models; read models power feeds/home.
- **Activity / Activity Engine** — Append-only feed of meaningful events. ([02 §15](02_LifeOS_Platform_Architecture.md))
- **Notification / Notification Engine** — Declared notification intents delivered across channels. ([02 §15](02_LifeOS_Platform_Architecture.md))
- **Widget / Home Widget Engine** — Skill-contributed home cards; dynamic, capability-gated. ([02 §15](02_LifeOS_Platform_Architecture.md))

## Engineering

- **Modular Monolith** — One deployable, hard module boundaries, microservice-ready. ([ADR-0001](adr/adr-0001-modular-monolith.md))
- **Hexagonal / Ports & Adapters** — Domain depends on interfaces; adapters implement them. ([ADR-0003](adr/adr-0003-hexagonal-ddd.md))
- **Port** — A domain-owned interface; **Adapter** — its implementation.
- **DDD / Bounded Context** — Each Skill/engine is a context with its own language.
- **Contracts (`@lifeos/contracts`)** — All public interfaces/DTOs/events; versioned (semver). ([10 §1](10_API_STANDARD.md))
- **Frozen Contract** — A public interface that may not change without an ADR + version bump. ([06](06_PROJECT_STATE.md))
- **ADR** — Architecture Decision Record. ([08](08_ARCHITECTURE_DECISIONS.md))
- **Phase** — An independently completable unit of the roadmap. ([05](05_IMPLEMENTATION_ROADMAP.md))
- **PROJECT_STATE** — The live build-state document agents read first. ([06](06_PROJECT_STATE.md))
- **LifeOSError** — The typed error envelope. ([03 §5](03_LifeOS_Engineering_Handbook.md))

---

## Future Evolution

- Add terms as Skills/engines introduce them; never reuse a term for two meanings.
- When a term is renamed, keep the old entry marked *deprecated → see X* for one release.
