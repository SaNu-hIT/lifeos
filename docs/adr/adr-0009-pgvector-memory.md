# ADR-0009 — pgvector for Memory Embeddings (Not a Separate Vector DB)

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Chief Architect, AI Systems Architect
- **Tags:** memory, data, ai

Related: [02 §9](../02_LifeOS_Platform_Architecture.md) · [09 memory.\*](../09_DATABASE_DESIGN.md)

## Context

The Memory Engine stores facts, preferences, and summaries and retrieves them by **semantic similarity** (embeddings) combined with recency and importance. We need a vector store. The question is whether to add a dedicated vector database now or use Postgres's `pgvector` extension, given we already run Postgres (Supabase).

## Options considered

**A. Dedicated vector DB** (e.g. a specialized ANN service) from day one.
- Pros: best-in-class ANN performance at very large scale; advanced index options.
- Cons: a second datastore to operate, secure, back up, and keep consistent with Postgres; cross-store transactions impossible (memory rows in PG, vectors elsewhere → consistency burden); extra cost/complexity before we have scale that needs it.

**B. In-app / in-memory vector search.**
- Pros: trivial to start.
- Cons: doesn't persist or scale; not multi-instance safe. Non-starter.

**C. `pgvector` in our existing Postgres.**
- Pros: **one datastore** — vectors live next to the rows they describe; transactional consistency (write fact + embedding atomically); RLS applies to vectors too; HNSW/IVF indexes are good to large scale; no new ops surface; lower cost.
- Cons: not as specialized as a dedicated ANN engine at extreme scale; shares Postgres resources.

## Trade-offs

| Axis | A (dedicated) | B (in-memory) | C (pgvector) |
|------|---------------|---------------|--------------|
| Consistency with memory rows | hard | n/a | transactional |
| Ops surface | +1 datastore | none | none (reuse PG) |
| Security (RLS on vectors) | separate | none | unified |
| Performance at extreme scale | best | poor | good (revisit) |
| Cost/complexity now | high | low | low |

## Decision

Use **`pgvector`** in Postgres for memory embeddings, with an **HNSW** index, stored in `memory.embeddings` alongside `memory.facts`/`memory.summaries` ([09](../09_DATABASE_DESIGN.md)). Retrieval ranks by `similarity × recency × importance`. Short-term memory uses **Redis** (ephemeral), not Postgres.

## Consequences

- ✅ Atomic writes of a fact and its embedding; no cross-store drift.
- ✅ RLS and our single backup/security model cover vectors too ([11](../11_SECURITY_GUIDE.md)).
- ✅ No new datastore to run — faster delivery, lower cost.
- ⚠️ Vector search shares Postgres capacity → monitor; index tuning (HNSW params) required.
- ⚠️ At very large scale, ANN on Postgres may become a bottleneck.

## Future impact

Because the Memory Engine accesses vectors through a **port** ([ADR-0003](adr-0003-hexagonal-ddd.md)), moving to a dedicated vector store later is an adapter swap, not a rewrite. **Revisit trigger:** when embedding volume or query latency breaches targets in [phase-34](../05_IMPLEMENTATION_ROADMAP.md), evaluate a dedicated store via a new ADR.
