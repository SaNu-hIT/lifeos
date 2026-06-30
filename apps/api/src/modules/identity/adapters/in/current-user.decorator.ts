import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@lifeos/contracts';
import type { AuthedRequest } from './auth.guard.js';

/** Injects the authenticated user (set by AuthGuard) into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined =>
    context.switchToHttp().getRequest<AuthedRequest>().user,
);
