import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from './request-context.js';

/** Assigns/propagates a requestId and opens the request context for the call chain. */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 ? incoming : `req_${randomUUID()}`;
    res.setHeader('x-request-id', requestId);
    runWithRequestContext({ requestId }, () => next());
  }
}
