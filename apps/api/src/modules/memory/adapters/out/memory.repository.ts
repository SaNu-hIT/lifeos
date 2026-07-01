import type { Fact, Preference, Summary } from '@lifeos/contracts';
import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type { NewFact, NewPreference, NewSummary } from '../../domain/ports/memory.port.js';

export interface FactCandidate {
  fact: Fact;
  createdAt: string;
  embedding: number[];
}

/** Persistence for memory. Writes/reads run in USER context so RLS enforces that a
 *  user only ever touches their own memory; purge runs in service context. */
export class MemoryRepository {
  constructor(private readonly db: DatabasePort) {}

  async insertFact(userId: string, fact: NewFact, embedding: number[]): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        const inserted = await tx.query<{ id: string }>(
          `insert into memory.facts (user_id, scope, statement, importance, source, expires_at)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [userId, fact.scope, fact.statement, fact.importance ?? 1, fact.source ?? null, fact.expiresAt ?? null],
        );
        const factId = inserted.rows[0]!.id;
        await tx.query(
          `insert into memory.embeddings (user_id, owner_kind, owner_id, embedding)
           values ($1, 'fact', $2, $3)`,
          [userId, factId, JSON.stringify(embedding)],
        );
      },
      { as: 'user', userId },
    );
  }

  async upsertPreference(userId: string, pref: NewPreference): Promise<void> {
    await this.db.transaction(
      (tx) =>
        tx.query(
          `insert into memory.preferences (user_id, scope, key, value)
           values ($1, $2, $3, $4)
           on conflict (user_id, scope, key) do update set value = excluded.value, updated_at = now()`,
          [userId, pref.scope, pref.key, JSON.stringify(pref.value)],
        ),
      { as: 'user', userId },
    );
  }

  async insertSummary(userId: string, summary: NewSummary): Promise<void> {
    await this.db.transaction(
      (tx) =>
        tx.query(
          `insert into memory.summaries (user_id, conversation_id, summary) values ($1, $2, $3)`,
          [userId, summary.conversationId ?? null, summary.summary],
        ),
      { as: 'user', userId },
    );
  }

  async loadFactCandidates(userId: string, scope?: string): Promise<FactCandidate[]> {
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<{
          id: string;
          scope: string;
          statement: string;
          importance: number;
          created_at: string;
          embedding: number[];
        }>(
          `select f.id, f.scope, f.statement, f.importance, f.created_at, e.embedding
             from memory.facts f
             join memory.embeddings e on e.owner_kind = 'fact' and e.owner_id = f.id
            where (f.expires_at is null or f.expires_at > now())
              and ($1::text is null or f.scope = $1)`,
          [scope ?? null],
        );
        return rows.rows.map((r) => ({
          fact: { id: r.id, scope: r.scope, statement: r.statement, importance: r.importance },
          createdAt: r.created_at,
          embedding: r.embedding,
        }));
      },
      { as: 'user', userId },
    );
  }

  async loadPreferences(userId: string, scope?: string): Promise<Preference[]> {
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<{ key: string; value: unknown; scope: string }>(
          `select key, value, scope from memory.preferences
            where ($1::text is null or scope = $1)`,
          [scope ?? null],
        );
        return rows.rows.map((r) => ({ key: r.key, value: r.value, scope: r.scope }));
      },
      { as: 'user', userId },
    );
  }

  async loadRecentSummaries(userId: string, limit: number): Promise<Summary[]> {
    return this.db.transaction(
      async (tx) => {
        const rows = await tx.query<{ id: string; summary: string }>(
          `select id, summary from memory.summaries order by created_at desc limit $1`,
          [limit],
        );
        return rows.rows.map((r) => ({ id: r.id, summary: r.summary }));
      },
      { as: 'user', userId },
    );
  }

  /** Service-context sweep across all users. */
  async purgeExpired(): Promise<number> {
    const purged = await this.db.query(
      'delete from memory.facts where expires_at is not null and expires_at < now() returning id',
    );
    await this.db.query(
      "delete from memory.embeddings where owner_kind = 'fact' and owner_id not in (select id from memory.facts)",
    );
    return purged.rowCount;
  }
}
