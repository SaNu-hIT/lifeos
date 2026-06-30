import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { type ApiResponse, type AuthUser, ErrorCodes, LifeOSError } from '@lifeos/contracts';
import { ok } from '../../../../shared/http/envelope.js';
import { loadAppConfig } from '../../../../config/app-config.js';
import { AUTH_PORT, type AuthPort } from '../../domain/ports/auth.port.js';
import type { UserRecord } from '../../domain/ports/user-repository.port.js';
import { ProvisionUserService } from '../../application/provision-user.service.js';
import { DevAuthAdapter } from '../out/dev-auth.adapter.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import { DevSessionDto } from './dev-session.dto.js';

@Controller({ version: '1' })
export class IdentityController {
  constructor(
    @Inject(AUTH_PORT) private readonly auth: AuthPort,
    private readonly provisioner: ProvisionUserService,
  ) {}

  /**
   * DEV-ONLY: mint a local JWT for a user id/email so the rest of the API can be
   * exercised without Supabase. Disabled outside non-production environments.
   * In deployment this is replaced by exchanging a Supabase token.
   */
  @Post('auth/session')
  session(@Body() dto: DevSessionDto): ApiResponse<{ token: string; userId: string }> {
    if (loadAppConfig().NODE_ENV === 'production') {
      throw new LifeOSError({
        code: ErrorCodes.NOT_FOUND,
        status: 404,
        message: 'Not available',
      });
    }
    if (!(this.auth instanceof DevAuthAdapter)) {
      throw new LifeOSError({
        code: ErrorCodes.DEPENDENCY_UNAVAILABLE,
        status: 503,
        message: 'Dev session minting is not available',
      });
    }
    const userId = dto.userId ?? randomUUID();
    const token = this.auth.mintToken({ id: userId, email: dto.email });
    return ok({ token, userId });
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<ApiResponse<UserRecord>> {
    return ok(await this.provisioner.ensure(user));
  }
}
