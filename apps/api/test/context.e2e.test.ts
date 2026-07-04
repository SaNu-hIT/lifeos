import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalAIProvider } from '@lifeos/ai-core';
import type {
  CapabilityKey,
  ContextProvider,
  PermissionDecision,
  PermissionPort,
  UnifiedContext,
} from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { MemoryEngine } from '../src/modules/memory/memory.engine.js';
import { MemoryRepository } from '../src/modules/memory/adapters/out/memory.repository.js';
import { UserReader } from '../src/modules/context/adapters/out/user-reader.js';
import { ContextProviderRegistry } from '../src/modules/context/context-provider-registry.js';
import { ContextEngine } from '../src/modules/context/context.engine.js';
import {
  NullConversationReader,
  NullSettingsReader,
} from '../src/modules/context/domain/ports/readers.js';
import type { CachePort } from '../src/shared/cache/cache.port.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

const permissions: PermissionPort = {
  can: async (): Promise<PermissionDecision> => ({ allow: true }),
  capabilitiesFor: async () => ['grocery.order', 'grocery.read'] as CapabilityKey[],
};

class MapCache implements CachePort {
  store = new Map<string, string>();
  async get(k: string) {
    return this.store.get(k) ?? null;
  }
  async set(k: string, v: string) {
    this.store.set(k, v);
  }
  async del(k: string) {
    this.store.delete(k);
  }
}

describe('Phase 13 — context engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let engine: ContextEngine;
  let cache: MapCache;
  const userId = randomUUID();

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    await db.query('insert into platform.users (id, email, locale) values ($1, $2, $3)', [
      userId,
      `ctx_${userId}@test.local`,
      'en-IN',
    ]);
    const memory = new MemoryEngine(new MemoryRepository(db), new LocalAIProvider());
    await memory.writeFact(userId, { scope: 'grocery', statement: 'user prefers oat milk' });

    const providers = new ContextProviderRegistry();
    const groceryProvider: ContextProvider = {
      scope: 'grocery',
      contribute: async (): Promise<Partial<UnifiedContext>> => ({
        settings: { lowStockThreshold: 2 },
      }),
    };
    providers.register(groceryProvider);

    cache = new MapCache();
    engine = new ContextEngine(
      permissions,
      memory,
      new UserReader(db),
      new NullConversationReader(),
      new NullSettingsReader(),
      providers,
      cache,
    );
  });

  afterAll(async () => {
    await db.query('delete from memory.embeddings where user_id = $1', [userId]);
    await db.query('delete from memory.facts where user_id = $1', [userId]);
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('assembles a permission-filtered context with memory + provider contributions', async () => {
    const ctx = await engine.assemble({
      userId,
      conversationId: 'conv-1',
      scope: 'grocery',
      intentHint: 'what milk does the user like',
    });

    expect(ctx.user.id).toBe(userId);
    expect(ctx.user.locale).toBe('en-IN');
    expect(ctx.capabilities).toContain('grocery.order');
    expect(ctx.memory.facts[0]?.statement).toBe('user prefers oat milk');
    expect(ctx.settings.lowStockThreshold).toBe(2); // from the Skill provider
    expect(ctx.conversation.recentTurns).toEqual([]); // null reader until phase-15
    expect(ctx.scope).toBe('grocery');
  });

  it('caches the assembled context (short TTL)', async () => {
    const input = { userId, conversationId: 'conv-1', scope: 'grocery', intentHint: 'milk' };
    await engine.assemble(input);
    expect(cache.store.has(`ctx:${userId}:conv-1:grocery:milk`)).toBe(true);
    // Second call is served from cache (same object shape).
    const again = await engine.assemble(input);
    expect(again.user.id).toBe(userId);
  });
});
