import { loadConfig, z } from '@lifeos/config';

/** The insecure dev default; forbidden in production (docs/11 §4). */
export const INSECURE_JWT_SECRET = 'dev-insecure-secret-change-me';

/** Validated configuration for the API. Invalid env fails the boot (docs/13 §4). */
export const AppConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    // Postgres connection. Local default is the dev database; in deployment this is
    // the Supabase/managed Postgres URL (docs/adr/adr-0010-supabase-baas.md).
    DATABASE_URL: z.string().url().default('postgres://localhost:5432/lifeos_dev'),
    // Secret for the local dev JWT auth adapter. MUST be overridden in any non-local
    // environment (the Supabase auth adapter replaces this in deployment — KI-003).
    AUTH_JWT_SECRET: z.string().min(8).default(INSECURE_JWT_SECRET),
    // Redis connection for BullMQ (queues) and short-term state.
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    // AI provider selection (docs/adr/adr-0004). 'local' is the deterministic dev
    // provider; 'openai' etc. are added later and require credentials.
    AI_PROVIDER: z.string().default('local'),
    OPENAI_API_KEY: z.string().optional(),
    // Requests per minute per principal (userId or IP) at the API edge. 0 disables
    // limiting — the default for local/test; production overrides it (docs/10 §5).
    RATE_LIMIT_RPM: z.coerce.number().int().min(0).default(0),
    // Postgres connection-pool tuning (docs/34 performance). Sized per instance;
    // total connections = instances × DB_POOL_MAX must stay under the server limit.
    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_POOL_IDLE_MS: z.coerce.number().int().min(0).default(30_000),
    DB_CONN_TIMEOUT_MS: z.coerce.number().int().min(0).default(5_000),
    // Max accepted request body (docs/11 §4). Bounded to blunt payload-flood DoS.
    MAX_BODY_SIZE: z.string().default('1mb'),
  })
  .superRefine((cfg, ctx) => {
    // Fail the boot rather than run production on the shipped dev secret.
    if (cfg.NODE_ENV === 'production' && cfg.AUTH_JWT_SECRET === INSECURE_JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_JWT_SECRET'],
        message: 'AUTH_JWT_SECRET must be overridden in production (the dev default is forbidden)',
      });
    }
  });

export type AppConfig = z.infer<typeof AppConfigSchema>;

/** DI token for the resolved AppConfig. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return loadConfig(AppConfigSchema, env);
}
