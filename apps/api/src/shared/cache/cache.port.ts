/** DI token for the CachePort. */
export const CACHE = Symbol('CACHE');

/** A minimal key/value cache with TTL. Backed by Redis in deployment. */
export interface CachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
