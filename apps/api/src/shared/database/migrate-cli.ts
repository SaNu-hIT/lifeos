// CLI entry: `pnpm --filter @lifeos/api migrate`. Applies pending migrations to
// the configured DATABASE_URL.
import { loadAppConfig } from '../../config/app-config.js';
import { runMigrations } from './migrate.js';

async function main(): Promise<void> {
  const config = loadAppConfig();
  const result = await runMigrations(config.DATABASE_URL);
  if (result.applied.length === 0) {
    console.log(JSON.stringify({ msg: 'migrations up to date', skipped: result.skipped.length }));
  } else {
    console.log(JSON.stringify({ msg: 'migrations applied', applied: result.applied }));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
