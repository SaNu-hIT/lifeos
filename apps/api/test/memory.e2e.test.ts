import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalAIProvider } from '@lifeos/ai-core';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { MemoryRepository } from '../src/modules/memory/adapters/out/memory.repository.js';
import { MemoryEngine } from '../src/modules/memory/memory.engine.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 12 — memory engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let memory: MemoryEngine;
  const userId = randomUUID();

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    memory = new MemoryEngine(new MemoryRepository(db), new LocalAIProvider());
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `mem_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query('delete from memory.embeddings where user_id = $1', [userId]);
    await db.query('delete from memory.facts where user_id = $1', [userId]);
    await db.query('delete from memory.preferences where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('retrieves the most semantically relevant fact first', async () => {
    await memory.writeFact(userId, { scope: 'grocery', statement: 'user prefers oat milk' });
    await memory.writeFact(userId, { scope: 'grocery', statement: 'user is vegetarian' });
    await memory.writeFact(userId, { scope: 'fitness', statement: 'user likes morning workouts' });

    const bundle = await memory.retrieve(userId, { query: 'what milk does the user like', scope: 'grocery' });
    expect(bundle.facts[0]?.statement).toBe('user prefers oat milk');
    // scope filter keeps fitness facts out
    expect(bundle.facts.every((f) => f.scope === 'grocery')).toBe(true);
  });

  it('excludes expired facts and returns preferences', async () => {
    await memory.writeFact(userId, {
      scope: 'grocery',
      statement: 'user wanted almond milk once',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    await memory.writePreference(userId, { scope: 'grocery', key: 'preferred_provider', value: 'zepto' });

    const bundle = await memory.retrieve(userId, { query: 'almond milk', scope: 'grocery' });
    expect(bundle.facts.some((f) => f.statement.includes('almond'))).toBe(false);
    expect(bundle.preferences.find((p) => p.key === 'preferred_provider')?.value).toBe('zepto');
  });

  it('purges expired facts', async () => {
    const purged = await memory.purgeExpired();
    expect(purged).toBeGreaterThanOrEqual(1);
    const remaining = await db.query(
      'select 1 from memory.facts where user_id = $1 and expires_at is not null and expires_at < now()',
      [userId],
    );
    expect(remaining.rowCount).toBe(0);
  });
});
