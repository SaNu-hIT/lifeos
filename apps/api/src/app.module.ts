import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { APP_CONFIG, loadAppConfig } from './config/app-config.js';
import { RequestIdMiddleware } from './shared/context/request-id.middleware.js';
import { SecurityHeadersMiddleware } from './shared/http/security-headers.middleware.js';
import { RateLimitGuard } from './shared/http/rate-limit.guard.js';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { CacheModule } from './shared/cache/cache.module.js';
import { AuditModule } from './shared/audit/audit.module.js';
import { AiCoreModule } from './shared/ai/ai-core.module.js';
import { EventsModule } from './shared/events/events.module.js';
import { ObservabilityModule } from './shared/observability/observability.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { PermissionModule } from './modules/permission/permission.module.js';
import { SubscriptionModule } from './modules/subscription/subscription.module.js';
import { ToolRegistryModule } from './modules/tool-registry/tool-registry.module.js';
import { SkillRegistryModule } from './modules/skill-registry/skill-registry.module.js';
import { ConnectorRegistryModule } from './modules/connector-registry/connector-registry.module.js';
import { MemoryModule } from './modules/memory/memory.module.js';
import { ConversationModule } from './modules/conversation/conversation.module.js';
import { ContextModule } from './modules/context/context.module.js';
import { PlannerModule } from './modules/planner/planner.module.js';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module.js';
import { WorkflowModule } from './modules/workflow/workflow.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { NotificationModule } from './modules/notification/notification.module.js';
import { HomeModule } from './modules/home/home.module.js';
import { SkillHostModule } from './modules/skill-host/skill-host.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { ConsoleModule } from './modules/console/console.module.js';

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    AuditModule,
    AiCoreModule,
    EventsModule,
    ObservabilityModule,
    HealthModule,
    IdentityModule,
    PermissionModule,
    SubscriptionModule,
    ToolRegistryModule,
    SkillRegistryModule,
    ConnectorRegistryModule,
    MemoryModule,
    ConversationModule,
    ContextModule,
    PlannerModule,
    OrchestratorModule,
    WorkflowModule,
    ActivityModule,
    NotificationModule,
    HomeModule,
    SkillHostModule,
    RealtimeModule,
    ConsoleModule,
  ],
  providers: [
    // Validated config, loaded (and validated) once at construction.
    { provide: APP_CONFIG, useFactory: () => loadAppConfig() },
    // Standard error envelope for every uncaught exception.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Edge rate limiting (per userId/IP; no-op when RATE_LIMIT_RPM=0).
    { provide: APP_GUARD, useClass: RateLimitGuard },
    // Validate + transform all incoming DTOs; reject unknown properties.
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Security headers first, then request-id/context for the rest of the chain.
    consumer.apply(SecurityHeadersMiddleware, RequestIdMiddleware).forRoutes('*');
  }
}
