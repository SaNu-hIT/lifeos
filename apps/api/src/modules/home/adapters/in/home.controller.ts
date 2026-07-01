import { Body, Controller, Get, Inject, Param, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import type { ApiResponse, AuthUser } from '@lifeos/contracts';
import { ok } from '../../../../shared/http/envelope.js';
import { AuthGuard } from '../../../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../../../identity/adapters/in/current-user.decorator.js';
import { HOME_ENGINE, type HomeEnginePort, type HomeView } from '../../domain/ports/home.port.js';

class WidgetPreferenceDto {
  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsInt()
  sortOverride?: number;
}

@Controller({ path: 'home', version: '1' })
@UseGuards(AuthGuard)
export class HomeController {
  constructor(@Inject(HOME_ENGINE) private readonly home: HomeEnginePort) {}

  @Get()
  async get(@CurrentUser() user: AuthUser): Promise<ApiResponse<HomeView>> {
    return ok(await this.home.getHome(user.id));
  }

  @Patch('widgets/:key')
  async setPreference(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() body: WidgetPreferenceDto,
  ): Promise<ApiResponse<{ key: string }>> {
    await this.home.setPreference(user.id, key, body);
    return ok({ key });
  }
}
