import { loadConfig, z } from '@lifeos/config';

/** Validated configuration for the API. Invalid env fails the boot (docs/13 §4). */
export const AppConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** DI token for the resolved AppConfig. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return loadConfig(AppConfigSchema, env);
}
