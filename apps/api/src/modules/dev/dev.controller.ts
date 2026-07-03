import { Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { type ApiResponse, type AuthUser, ErrorCodes, LifeOSError } from '@lifeos/contracts';
import { ok } from '../../shared/http/envelope.js';
import { loadAppConfig } from '../../config/app-config.js';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { AuthGuard } from '../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../identity/adapters/in/current-user.decorator.js';
import { SubscriptionService } from '../subscription/application/subscription.service.js';

class SubscribeDto {
  @IsString()
  planKey!: string;
}

/** One saved grocery preference, flattened for the admin view. */
interface PreferenceView {
  productName: string;
  preferredBrand: string;
  preferredUnit?: string;
  updatedAt: string;
}

/** A user plus the preferences saved across Skills — the admin/overview shape. */
interface AdminUserView {
  id: string;
  email: string;
  createdAt: string;
  preferences: PreferenceView[];
}

/**
 * DEV-ONLY conveniences (disabled in production). Lets a locally-minted user grant
 * themselves a plan's capabilities without hand-writing SQL, so the Grocery/Calendar
 * tools become permitted end-to-end. Real billing drives this in deployment.
 */
@Controller({ path: 'dev', version: '1' })
@UseGuards(AuthGuard)
export class DevController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    @Inject(DATABASE) private readonly db: DatabasePort,
  ) {}

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

  /**
   * DEV-ONLY admin overview: every user and the preferences they've saved across
   * Skills. Runs in service context (bypasses RLS) so it can read across users — this
   * is an operator/debugging panel, disabled in production. It reads the Grocery
   * skill's `grocery.user_preferences` table by name (raw SQL, not a package import,
   * so the core→skill import boundary is intact); as more Skills persist preferences
   * this can fan out over them.
   */
  @Get('users')
  async users(): Promise<ApiResponse<AdminUserView[]>> {
    if (loadAppConfig().NODE_ENV === 'production') {
      throw new LifeOSError({ code: ErrorCodes.NOT_FOUND, status: 404, message: 'Not available' });
    }

    const users = await this.db.query<{ id: string; email: string; created_at: string }>(
      'select id, email, created_at from platform.users order by created_at desc',
    );
    const prefs = await this.db.query<{
      user_id: string;
      product_name: string;
      preferred_brand: string;
      preferred_unit: string | null;
      updated_at: string;
    }>(
      `select user_id, product_name, preferred_brand, preferred_unit, updated_at
         from grocery.user_preferences
        order by updated_at desc`,
    );

    const byUser = new Map<string, PreferenceView[]>();
    for (const p of prefs.rows) {
      const list = byUser.get(p.user_id) ?? [];
      list.push({
        productName: p.product_name,
        preferredBrand: p.preferred_brand,
        preferredUnit: p.preferred_unit ?? undefined,
        updatedAt: new Date(p.updated_at).toISOString(),
      });
      byUser.set(p.user_id, list);
    }

    return ok(
      users.rows.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: new Date(u.created_at).toISOString(),
        preferences: byUser.get(u.id) ?? [],
      })),
    );
  }
}
