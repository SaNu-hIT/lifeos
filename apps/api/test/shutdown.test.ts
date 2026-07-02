import { describe, expect, it } from 'vitest';
import { RedisCache } from '../src/shared/cache/redis-cache.js';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';

// Graceful shutdown (docs/36): every connection-owning adapter exposes an
// onModuleDestroy hook Nest invokes on SIGTERM. These verify the hooks exist and
// close cleanly even when nothing ever connected (lazy pools/clients).

describe('Phase 36 — graceful shutdown hooks', () => {
  it('RedisCache closes idempotently without an open connection', () => {
    const cache = new RedisCache('redis://127.0.0.1:6399'); // lazyConnect: never dials
    expect(() => cache.onModuleDestroy()).not.toThrow();
    expect(() => cache.onModuleDestroy()).not.toThrow(); // second call is safe
  });

  it('PgDatabaseAdapter closes its pool on destroy', async () => {
    const db = new PgDatabaseAdapter('postgres://127.0.0.1:5432/never', { max: 1 });
    await expect(db.onModuleDestroy()).resolves.toBeUndefined();
  });
});
