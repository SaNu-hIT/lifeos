import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { type ApiResponse, type AuthUser, ErrorCodes, LifeOSError } from '@lifeos/contracts';
import { ok } from '../../shared/http/envelope.js';
import { loadAppConfig } from '../../config/app-config.js';
import { AuthGuard } from '../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../identity/adapters/in/current-user.decorator.js';
import { SubscriptionService } from '../subscription/application/subscription.service.js';

class SubscribeDto {
  @IsString()
  planKey!: string;
}

/**
 * DEV-ONLY conveniences (disabled in production). Lets a locally-minted user grant
 * themselves a plan's capabilities without hand-writing SQL, so the Grocery/Calendar
 * tools become permitted end-to-end. Real billing drives this in deployment.
 */
@Controller({ path: 'dev', version: '1' })
@UseGuards(AuthGuard)
export class DevController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Post('subscribe')
  async subscribe(
    @CurrentUser() user: AuthUser,
    @Body() dto: SubscribeDto,
  ): Promise<ApiResponse<{ userId: string; planKey: string }>> {
    if (loadAppConfig().NODE_ENV === 'production') {
      throw new LifeOSError({ code: ErrorCodes.NOT_FOUND, status: 404, message: 'Not available' });
    }
    await this.subscriptions.changePlan(user.id, dto.planKey);
    return ok({ userId: user.id, planKey: dto.planKey });
  }
}
