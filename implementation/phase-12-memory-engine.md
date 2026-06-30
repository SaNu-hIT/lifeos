---
title: Phase 12 — Memory Engine (pgvector)
status: Scaffold
band: Core
phase: 12
depends_on: [4, 14]
estimate: 6–7 days
---

# Phase 12 — Memory Engine (pgvector)

> Scaffold. Spec refs: [02 §9](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0009](../docs/adr/adr-0009-pgvector-memory.md) · [09 memory.\*](../docs/09_DATABASE_DESIGN.md).

## Overview
Implement tiered memory: short-term (Redis), conversation summaries, long-term facts/preferences, and embeddings (pgvector). Provide write, retrieval (relevance × recency × importance), scoring, and expiration/decay.

## Objectives & Scope
- `memory.facts/preferences/summaries/embeddings` repositories behind ports.
- Embedding via AI Core (phase-14); HNSW retrieval.
- Memory scoring + top-k retrieval API used by Context Engine (phase-13).
- Expiration/decay sweep (BullMQ job); short-term memory in Redis.

## Key interfaces (to finalize)
```ts
export interface MemoryPort {
  writeFact(userId: string, fact: NewFact): Promise<void>;
  retrieve(userId: string, query: MemoryQuery): Promise<MemoryBundle>;  // facts/prefs/summaries
}
```

## Dependencies
Phase-04 (memory schema/pgvector), phase-14 (embeddings).

## Acceptance Criteria (draft)
- [ ] Facts/prefs/summaries persist; embeddings stored + retrievable by similarity.
- [ ] Retrieval ranks by relevance×recency×importance.
- [ ] Expiry/decay removes stale low-value memories; high-importance pinned.

## Definition of Done (draft)
- [ ] `MemoryPort` in contracts; tests green; [06](../docs/06_PROJECT_STATE.md) updated; DB version bumped.

## AI Coding Prompt
See [prompts/phase-12.md](../prompts/phase-12.md).

## Known Risks
- Retrieval quality/latency → tune HNSW; cache hot retrievals (phase-34).
- Over-retention/privacy → expiry + user-editable memory ([04 §7](../docs/04_LifeOS_Product_Specification.md)).

## Future Extension Points
Dedicated vector store if pgvector saturates ([ADR-0009](../docs/adr/adr-0009-pgvector-memory.md) revisit trigger); richer memory types.
