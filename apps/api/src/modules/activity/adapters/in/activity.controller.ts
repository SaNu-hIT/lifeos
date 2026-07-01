import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { ApiPage, AuthUser } from '@lifeos/contracts';
import { page } from '../../../../shared/http/envelope.js';
import { AuthGuard } from '../../../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../../../identity/adapters/in/current-user.decorator.js';
import {
  ACTIVITY_ENGINE,
  type ActivityEnginePort,
  type ActivityView,
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
  ): Promise<ApiPage<ActivityView>> {
    const result = await this.activity.getFeed(user.id, {
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
    return page(result.data, result.nextCursor);
  }
}
