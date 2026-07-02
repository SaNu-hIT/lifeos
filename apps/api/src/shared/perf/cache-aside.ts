import type { CachePort } from '../cache/cache.port.js';
import type { MetricsRegistry } from '../observability/metrics.registry.js';

/**
 * Read-through (cache-aside) helper for hot read paths (docs/34): serve from cache on a
 * hit, otherwise load, populate, and return. JSON-serialized so any structured value
 * works. Records `cache_hits_total` / `cache_misses_total{key}` when a registry is given.
 * A cache read that throws degrades to the loader (availability over freshness).
 */
export async function cacheAside<T>(
  cache: CachePort,
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
  metrics?: MetricsRegistry,
): Promise<T> {
  let cached: string | null = null;
  try {
    cached = await cache.get(key);
  } catch {
    cached = null; // treat cache outage as a miss
  }

  if (cached !== null) {
    metrics?.increment('cache_hits_total', { key });
    return JSON.parse(cached) as T;
  }

  metrics?.increment('cache_misses_total', { key });
  const value = await loader();
  try {
    await cache.set(key, JSON.stringify(value), ttlSeconds);
  } catch {
    // best-effort population; the value is still returned
  }
  return value;
}
