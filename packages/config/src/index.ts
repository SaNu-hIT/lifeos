// @lifeos/config — typed, validated configuration loading.
//
// Nothing in the codebase reads process.env directly; configuration flows through
// this package and is validated against a schema at boot. Invalid config fails fast
// (docs/03_LifeOS_Engineering_Handbook.md §6, docs/13_DEPLOYMENT_GUIDE.md §4).

import type { z as ZodNamespace, ZodTypeAny } from 'zod';

export { z } from 'zod';

/** Read a required string config value, throwing if absent. */
export function requireEnv(key: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required configuration: ${key}`);
  }
  return value;
}

/**
 * Validate and parse configuration against a schema. Throws a single aggregated
 * error listing every problem, so misconfiguration is caught at boot — not at the
 * first request that happens to need the missing value.
 */
export function loadConfig<S extends ZodTypeAny>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): ZodNamespace.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${issues}`);
  }
  return result.data;
}
