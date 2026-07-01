import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/shared/http/rate-limit.js';

describe('Phase 28 — RateLimiter (unit)', () => {
  it('allows up to the limit then denies within a window', () => {
    const rl = new RateLimiter(2, 60_000);
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 10).allowed).toBe(true);
    const denied = rl.check('k', 20);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter(1, 1_000);
    expect(rl.check('k', 0).allowed).toBe(true);
    expect(rl.check('k', 500).allowed).toBe(false);
    expect(rl.check('k', 1_000).allowed).toBe(true); // new window
  });

  it('keys are independent', () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.check('a', 0).allowed).toBe(true);
    expect(rl.check('b', 0).allowed).toBe(true);
    expect(rl.check('a', 0).allowed).toBe(false);
  });

  it('a non-positive limit disables limiting', () => {
    const rl = new RateLimiter(0, 60_000);
    for (let i = 0; i < 100; i += 1) expect(rl.check('k', i).allowed).toBe(true);
  });
});
