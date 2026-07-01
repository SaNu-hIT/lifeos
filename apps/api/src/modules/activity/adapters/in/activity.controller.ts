import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { ApiResponse, AuthUser } from '@lifeos/contracts';
import { ok } from '../../../../shared/http/envelope.js';
import { AuthGuard } from '../../../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../../../identity/adapters/in/current-user.decorator.js';
import {
  ACTIVITY_ENGINE,
  type ActivityEnginePort,
  type ActivityPage,
} from '../../domain/ports/activity.port.js';

@Controller({ path: 'activities', version: '1' })
@UseGuards(AuthGuard)
export class ActivityController {
  constructor(@Inject(ACTIVITY_ENGINE) private readonly activity: ActivityEnginePort) {}

  @Get()
  async feed(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ApiResponse<ActivityPage>> {
    return ok(
      await this.activity.getFeed(user.id, { limit: limit ? Number(limit) : undefined, cursor }),
    );
  }
}
