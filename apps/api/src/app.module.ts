import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { APP_CONFIG, loadAppConfig } from './config/app-config.js';
import { RequestIdMiddleware } from './shared/context/request-id.middleware.js';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { CacheModule } from './shared/cache/cache.module.js';
import { AuditModule } from './shared/audit/audit.module.js';
import { AiCoreModule } from './shared/ai/ai-core.module.js';
import { EventsModule } from './shared/events/events.module.js';
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

@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    AuditModule,
    AiCoreModule,
    EventsModule,
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
  ],
  providers: [
    // Validated config, loaded (and validated) once at construction.
    { provide: APP_CONFIG, useFactory: () => loadAppConfig() },
    // Standard error envelope for every uncaught exception.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Validate + transform all incoming DTOs; reject unknown properties.
    {
      provide: APP_PIPE,
      useFactory: () => new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
