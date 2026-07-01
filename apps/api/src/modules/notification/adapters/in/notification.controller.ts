import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { ApiResponse, AuthUser } from '@lifeos/contracts';
import { ok } from '../../../../shared/http/envelope.js';
import { AuthGuard } from '../../../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../../../identity/adapters/in/current-user.decorator.js';
import {
  NOTIFICATION_ENGINE,
  type NotificationEnginePort,
  type NotificationPage,
} from '../../domain/ports/notification.port.js';

@Controller({ path: 'notifications', version: '1' })
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(@Inject(NOTIFICATION_ENGINE) private readonly notifications: NotificationEnginePort) {}

  @Get()
  async inbox(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ApiResponse<NotificationPage>> {
    return ok(
      await this.notifications.getInbox(user.id, {
        limit: limit ? Number(limit) : undefined,
        cursor,
      }),
    );
  }

  @Post(':id/read')
  @HttpCode(200)
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ id: string }>> {
    await this.notifications.markRead(user.id, id);
    return ok({ id });
  }
}
