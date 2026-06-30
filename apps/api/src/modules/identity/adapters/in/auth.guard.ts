import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { type AuthUser, ErrorCodes, LifeOSError } from '@lifeos/contracts';
import type { Request } from 'express';
import { AUTH_PORT, type AuthPort } from '../../domain/ports/auth.port.js';
import { getRequestContext } from '../../../../shared/context/request-context.js';

export type AuthedRequest = Request & { user?: AuthUser };

/** Rejects unauthenticated requests; on success binds the user to the request and
 *  the request context (docs/11_SECURITY_GUIDE.md). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AUTH_PORT) private readonly auth: AuthPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new LifeOSError({
        code: ErrorCodes.UNAUTHENTICATED,
        status: 401,
        message: 'Missing bearer token',
      });
    }

    let user: AuthUser;
    try {
      user = await this.auth.verifyToken(header.slice('Bearer '.length));
    } catch {
      throw new LifeOSError({
        code: ErrorCodes.UNAUTHENTICATED,
        status: 401,
        message: 'Invalid or expired token',
      });
    }

    req.user = user;
    const ctx = getRequestContext();
    if (ctx) ctx.userId = user.id;
    return true;
  }
}
