import { loadConfig, z } from '@lifeos/config';

/** Validated configuration for the API. Invalid env fails the boot (docs/13 §4). */
export const AppConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // Postgres connection. Local default is the dev database; in deployment this is
  // the Supabase/managed Postgres URL (docs/adr/adr-0010-supabase-baas.md).
  DATABASE_URL: z.string().url().default('postgres://localhost:5432/lifeos_dev'),
  // Secret for the local dev JWT auth adapter. MUST be overridden in any non-local
  // environment (the Supabase auth adapter replaces this in deployment — KI-003).
  AUTH_JWT_SECRET: z.string().min(8).default('dev-insecure-secret-change-me'),
  // Redis connection for BullMQ (queues) and short-term state.
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  // AI provider selection (docs/adr/adr-0004). 'local' is the deterministic dev
  // provider; 'openai' etc. are added later and require credentials.
  AI_PROVIDER: z.string().default('local'),
  OPENAI_API_KEY: z.string().optional(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** DI token for the resolved AppConfig. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return loadConfig(AppConfigSchema, env);
}
