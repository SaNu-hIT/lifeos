import type { AIProviderPort } from '@lifeos/ai-core';
import type { MemoryBundle } from '@lifeos/contracts';
import type {
  MemoryPort,
  MemoryQuery,
  NewFact,
  NewPreference,
  NewSummary,
} from './domain/ports/memory.port.js';
import type { MemoryRepository } from './adapters/out/memory.repository.js';
import { cosine, memoryScore } from './scoring.js';

const DEFAULT_LIMIT = 5;

/** The Memory Engine. Embeds via the AI provider, persists, and retrieves the most
 *  relevant memories ranked by similarity × recency × importance (docs/02 §9). */
export class MemoryEngine implements MemoryPort {
  constructor(
    private readonly repo: MemoryRepository,
    private readonly ai: AIProviderPort,
  ) {}

  async writeFact(userId: string, fact: NewFact): Promise<void> {
    const [embedding] = await this.ai.embed([fact.statement]);
    await this.repo.insertFact(userId, fact, embedding ?? []);
  }

  async writePreference(userId: string, pref: NewPreference): Promise<void> {
    await this.repo.upsertPreference(userId, pref);
  }

  async writeSummary(userId: string, summary: NewSummary): Promise<void> {
    await this.repo.insertSummary(userId, summary);
  }

  async retrieve(userId: string, query: MemoryQuery): Promise<MemoryBundle> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [queryEmbedding] = await this.ai.embed([query.query]);
    const candidates = await this.repo.loadFactCandidates(userId, query.scope);
    const nowMs = Date.now();

    const ranked = candidates
      .map((c) => ({
        fact: c.fact,
        score: memoryScore(
          cosine(queryEmbedding ?? [], c.embedding),
          c.fact.importance,
          c.createdAt,
          nowMs,
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.fact);

    const [preferences, summaries] = await Promise.all([
      this.repo.loadPreferences(userId, query.scope),
      this.repo.loadRecentSummaries(userId, limit),
    ]);

    return { facts: ranked, preferences, summaries };
  }

  async purgeExpired(): Promise<number> {
    return this.repo.purgeExpired();
  }
}
