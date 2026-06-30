import { Redis } from 'ioredis';
import type { CachePort } from './cache.port.js';

/** Redis-backed cache. lazyConnect so surfaces that never cache don't open a
 *  connection. */
export class RedisCache implements CachePort {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
    // ioredis requires an error listener; without one its (often transient/teardown)
    // errors become unhandled rejections. Cache is non-critical — failures degrade to misses.
    this.redis.on('error', () => {
      /* swallow: callers tolerate cache unavailability */
    });
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // Duck-typed Nest lifecycle hook. disconnect() is safe whether or not the lazy
  // connection ever opened; the error listener above absorbs any teardown noise.
  onModuleDestroy(): void {
    if (this.redis.status !== 'end') this.redis.disconnect();
  }
}
