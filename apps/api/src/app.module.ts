import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { APP_CONFIG, loadAppConfig } from './config/app-config.js';
import { RequestIdMiddleware } from './shared/context/request-id.middleware.js';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [DatabaseModule, HealthModule],
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
