// A small in-memory sliding-window rate limiter for the API edge. Deliberately
// dependency-free (no @nestjs/throttler): per-key fixed-window counters, good enough
// for single-instance dev/hardening. A distributed limiter (Redis) replaces this at
// scale — the guard depends only on this interface, so that swap is local.

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the current window resets (for Retry-After). */
  retryAfterSeconds: number;
}

export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  /** @param limit max requests per window; <= 0 disables limiting.
   *  @param windowMs window length in ms. */
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now: number): RateLimitDecision {
    if (this.limit <= 0) return { allowed: true, retryAfterSeconds: 0 };

    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Drop expired windows (call periodically if long-running). */
  sweep(now: number): void {
    for (const [key, entry] of this.hits) {
      if (now >= entry.resetAt) this.hits.delete(key);
    }
  }
}
