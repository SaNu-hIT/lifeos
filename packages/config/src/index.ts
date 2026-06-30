// @lifeos/config — typed, validated configuration loader.
//
// Phase 01 ships the skeleton only. Later phases add the schema-validated env
// loader that fails fast on invalid configuration (docs/03_LifeOS_Engineering_Handbook.md §6,
// docs/13_DEPLOYMENT_GUIDE.md §4). Nothing in the codebase should read process.env
// directly — it goes through this package.

/** Read a required string config value, throwing if absent. Placeholder implementation. */
export function requireEnv(key: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required configuration: ${key}`);
  }
  return value;
}
