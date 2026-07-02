import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { loadAppConfig } from './config/app-config.js';
import { StructuredLogger } from './shared/logging/logger.js';

/**
 * Creates and configures the Nest application (without listening). Shared by the
 * runtime bootstrap and the e2e tests so both exercise the same global pipeline.
 */
export async function createApp(): Promise<INestApplication> {
  const config = loadAppConfig();
  // Own the body parsers so we can bound payload size (docs/11 §4) — blunts a trivial
  // memory-exhaustion DoS. Oversized bodies are rejected with 413.
  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  app.use(json({ limit: config.MAX_BODY_SIZE }));
  app.use(urlencoded({ extended: true, limit: config.MAX_BODY_SIZE }));
  // URI versioning → routes are served under /v1/... (docs/10_API_STANDARD.md §1).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  return app;
}

export async function bootstrap(): Promise<INestApplication> {
  const config = loadAppConfig(); // fails fast on invalid configuration
  const logger = new StructuredLogger(config.LOG_LEVEL);
  const app = await createApp();
  // Graceful shutdown (docs/36): on SIGTERM/SIGINT Nest runs every onModuleDestroy —
  // the DB pool, Redis, and the BullMQ worker/queue drain and close cleanly.
  app.enableShutdownHooks();
  await app.listen(config.PORT);
  logger.info('LifeOS API started', { port: config.PORT, env: config.NODE_ENV });
  return app;
}

// Auto-start only when executed directly (node dist/main.js), not when imported.
if (process.argv[1]?.endsWith('main.js')) {
  bootstrap().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
