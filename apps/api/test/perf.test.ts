import { describe, expect, it, vi } from 'vitest';
import { summarizeLatencies } from '../src/shared/perf/latency.js';
import { runLoadTest } from '../src/shared/perf/loadtest.js';
import { cacheAside } from '../src/shared/perf/cache-aside.js';
import type { CachePort } from '../src/shared/cache/cache.port.js';

describe('Phase 34 — latency summary', () => {
  it('computes percentiles by nearest rank', () => {
    const s = summarizeLatencies([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(s).toMatchObject({ count: 10, min: 10, p50: 50, p95: 100, max: 100 });
  });

  it('is safe on an empty sample', () => {
    expect(summarizeLatencies([])).toMatchObject({ count: 0, p50: 0, max: 0 });
  });
});

describe('Phase 34 — load harness', () => {
  it('dispatches exactly `total` requests with bounded concurrency', async () => {
    let inflight = 0;
    let peak = 0;
    const fetchImpl = vi.fn(async () => {
      inflight += 1;
      peak = Math.max(peak, inflight);
      await new Promise((r) => setTimeout(r, 1));
      inflight -= 1;
      return { ok: true } as Response;
    });
    const result = await runLoadTest('http://x', 20, 4, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(20);
    expect(result).toMatchObject({ total: 20, ok: 20, failed: 0 });
    expect(peak).toBeLessThanOrEqual(4); // concurrency cap respected
  });
});

describe('Phase 34 — cacheAside', () => {
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

  it('loads on miss, then serves from cache on hit', async () => {
    const cache = new MapCache();
    const loader = vi.fn(async () => ({ n: 42 }));
    const a = await cacheAside(cache, 'k', 60, loader);
    const b = await cacheAside(cache, 'k', 60, loader);
    expect(a).toEqual({ n: 42 });
    expect(b).toEqual({ n: 42 });
    expect(loader).toHaveBeenCalledTimes(1); // second call was a cache hit
  });

  it('falls back to the loader when the cache read throws', async () => {
    const brokenCache: CachePort = {
      get: async () => {
        throw new Error('redis down');
      },
      set: async () => {},
      del: async () => {},
    };
    const value = await cacheAside(brokenCache, 'k', 60, async () => 'ok');
    expect(value).toBe('ok');
  });
});
