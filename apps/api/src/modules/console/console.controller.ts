import { randomUUID } from 'node:crypto';
import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import {
  CONNECTOR_REGISTRY,
  ErrorCodes,
  LifeOSError,
  PERMISSION_PORT,
  SKILL_REGISTRY,
  type ApiResponse,
  type AuthUser,
  type CapabilityKey,
  type ConnectorRegistryPort,
  type PermissionPort,
  type SkillDescriptor,
  type SkillRegistryPort,
  type UnifiedContext,
} from '@lifeos/contracts';
import { ok } from '../../shared/http/envelope.js';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import {
  CONTEXT_ENGINE,
  type ContextEnginePort,
} from '../context/domain/ports/context-engine.port.js';
import { AuthGuard } from '../identity/adapters/in/auth.guard.js';
import { CurrentUser } from '../identity/adapters/in/current-user.decorator.js';

interface ConnectorHealthView {
  key: string;
  domain: string;
  healthy: boolean;
  details?: string;
}

/** A registered Skill plus the caller's per-user on/off state. */
type SkillView = SkillDescriptor & { enabled: boolean };

class SkillEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

/**
 * Read-only introspection for the Developer Console (phase 31) — makes the platform's
 * decisions observable: which Skills/Connectors are registered, what capabilities the
 * caller holds, and exactly what Unified Context a Skill would receive. All under
 * AuthGuard; the context inspector is scoped to the calling user (RLS still applies).
 */
@Controller({ path: 'console', version: '1' })
@UseGuards(AuthGuard)
export class ConsoleController {
  constructor(
    @Inject(SKILL_REGISTRY) private readonly skills: SkillRegistryPort,
    @Inject(CONNECTOR_REGISTRY) private readonly connectors: ConnectorRegistryPort,
    @Inject(PERMISSION_PORT) private readonly permissions: PermissionPort,
    @Inject(CONTEXT_ENGINE) private readonly context: ContextEnginePort,
    @Inject(DATABASE) private readonly db: DatabasePort,
  ) {}

  @Get('skills')
  async skillList(@CurrentUser() user: AuthUser): Promise<ApiResponse<SkillView[]>> {
    // Per-user overrides live in catalog.user_skills; absence means enabled (default true).
    const rows = await this.db.query<{ skill_key: string; enabled: boolean }>(
      'select skill_key, enabled from catalog.user_skills where user_id = $1',
      [user.id],
    );
    const overrides = new Map(rows.rows.map((r) => [r.skill_key, r.enabled]));
    return ok(this.skills.list().map((s) => ({ ...s, enabled: overrides.get(s.key) ?? true })));
  }

  @Post('skills/:key/enabled')
  async setSkillEnabled(
    @CurrentUser() user: AuthUser,
    @Param('key') key: string,
    @Body() dto: SkillEnabledDto,
  ): Promise<ApiResponse<{ key: string; enabled: boolean }>> {
    if (!this.skills.get(key)) {
      throw new LifeOSError({ code: ErrorCodes.NOT_FOUND, status: 404, message: `unknown skill: ${key}` });
    }
    await this.skills.setEnabled(user.id, key, dto.enabled);
    return ok({ key, enabled: dto.enabled });
  }

  @Get('connectors')
  async connectorList(): Promise<ApiResponse<ConnectorHealthView[]>> {
    const views = await Promise.all(
      this.connectors.list().map(async (c): Promise<ConnectorHealthView> => {
        const health = await c.health().catch(() => ({ healthy: false, details: 'health check threw' }));
        return { key: c.key, domain: c.domain, healthy: health.healthy, details: health.details };
      }),
    );
    return ok(views);
  }

  @Get('capabilities')
  async capabilities(@CurrentUser() user: AuthUser): Promise<ApiResponse<CapabilityKey[]>> {
    return ok(await this.permissions.capabilitiesFor(user.id));
  }

  @Get('context')
  async inspectContext(
    @CurrentUser() user: AuthUser,
    @Query('conversationId') conversationId: string,
    @Query('scope') scope?: string,
    @Query('intentHint') intentHint?: string,
  ): Promise<ApiResponse<UnifiedContext>> {
    return ok(
      await this.context.assemble({
        userId: user.id,
        // A valid UUID is required (the conversation reader casts it); default to an
        // ephemeral one so inspection works without an existing conversation.
        conversationId: conversationId || randomUUID(),
        scope: scope ?? 'core',
        intentHint,
      }),
    );
  }
}
