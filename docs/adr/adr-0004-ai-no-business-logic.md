# ADR-0004 — The AI Layer Holds No Business Logic

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** CTO, AI Systems Architect
- **Tags:** ai, architecture, boundaries

Related: [02 §7](../02_LifeOS_Platform_Architecture.md) · [11 §3](../11_SECURITY_GUIDE.md)

## Context

LifeOS is AI-first, but the LLM is **probabilistic, slow, costly, and swappable** (OpenAI now; Claude, Gemini, OpenRouter, local models later). If business logic lives in prompts or in the AI layer, then: outcomes become non-deterministic and untestable; swapping the LLM changes product behavior; and a prompt injection could alter what the system *does*. We must define exactly what the AI is responsible for and what it is not.

## Options considered

**A. AI-centric ("the prompt is the program")** — business rules expressed in prompts; the model decides and acts.
- Pros: fast to prototype; flexible.
- Cons: non-deterministic core behavior; untestable; provider lock-in; security nightmare (injection alters logic); costs scale with every rule.

**B. AI-assisted with leaky boundaries** — mostly in Skills, but some logic in prompts "for convenience."
- Pros: pragmatic shortcuts.
- Cons: the boundary erodes over time; the worst of both worlds; hard to reason about.

**C. Strict boundary — AI only Understands / Plans / Executes(=orchestrates tools) / Summarizes; all business logic in Skills; Skills never call the LLM.**
- Pros: deterministic, testable Skills; provider-swappable with zero behavior change; injection is bounded by capabilities/tools; cost is controlled and explicit.
- Cons: more plumbing (intents → tools); the Planner must be constrained to registered tools.

## Trade-offs

| Axis | A (AI-centric) | B (leaky) | C (strict) |
|------|----------------|-----------|------------|
| Determinism/testability | poor | medium | excellent |
| Provider independence | poor | medium | excellent |
| Security (injection blast radius) | poor | medium | excellent (capability-bounded) |
| Flexibility/prototyping speed | high | high | medium |
| Long-term maintainability | poor | poor | excellent |

## Decision

The AI layer performs exactly four roles — **Understand, Plan, Execute, Summarize** — where "Execute" means *orchestrating registered tool calls*, never *implementing* them. **All business logic lives in Skills.** **Skills never call the LLM directly.** The **Planner** only produces an `ExecutionPlan`; execution flows through the **Tool Registry** with permission checks and schema validation. ([02 §7](../02_LifeOS_Platform_Architecture.md))

## Consequences

- ✅ Skills are deterministic and unit-testable; the LLM is mocked in tests ([12 §3](../12_TESTING_GUIDE.md)).
- ✅ Swapping LLM provider/model changes nothing about what Skills do.
- ✅ Prompt-injection blast radius is capped by the user's capabilities and per-tool confirmation ([11 §3](../11_SECURITY_GUIDE.md)).
- ✅ Cost/latency are isolated to understand/plan/summarize and can be optimized (model routing).
- ⚠️ More engineering to express needs as tools rather than prompt instructions — accepted as the cost of correctness.
- ⚠️ When a Skill genuinely needs language work, it must request it through a platform-mediated tool/capability, not by importing AI Core.

## Future impact

This is the single most important AI decision; it makes multi-LLM routing, local models, and cost optimization additive rather than disruptive. **Non-negotiable**; any exception requires a superseding ADR with an explicit security analysis.
