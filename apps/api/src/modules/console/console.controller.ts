import { randomUUID } from 'node:crypto';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  CONNECTOR_REGISTRY,
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
  ) {}

  @Get('skills')
  skillList(): ApiResponse<SkillDescriptor[]> {
    return ok(this.skills.list());
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
