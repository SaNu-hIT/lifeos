import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Conservative security response headers for the API edge (docs/11_SECURITY_GUIDE.md).
 * Hand-rolled (no helmet dependency) since the API serves JSON, not HTML — the set is
 * small and defensible. A CDN/ingress may add more (HSTS) in front of this.
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // The JSON API is never a document source; forbid all subresources defensively.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    // Don't advertise the framework.
    res.removeHeader('X-Powered-By');
    next();
  }
}
