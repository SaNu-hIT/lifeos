import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ErrorCodes, LifeOSError } from '@lifeos/contracts';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { getRequestContext } from '../context/request-context.js';
import { RateLimiter } from './rate-limit.js';

/**
 * Global rate-limit guard for the API edge (docs/10_API_STANDARD.md §5). Keys by
 * authenticated userId when present, else client IP. On breach it throws a 429
 * `RATE_LIMITED` — rendered by the standard error filter — and sets `Retry-After`.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: RateLimiter;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // 0 disables limiting (used in tests unless overridden).
    this.limiter = new RateLimiter(config.RATE_LIMIT_RPM, 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const key = getRequestContext()?.userId ?? req.ip ?? 'anonymous';
    const decision = this.limiter.check(key, Date.now());
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      throw new LifeOSError({
        code: ErrorCodes.RATE_LIMITED,
        status: 429,
        message: 'Too many requests',
        retryable: true,
        details: { retryAfterSeconds: decision.retryAfterSeconds },
      });
    }
    return true;
  }
}
