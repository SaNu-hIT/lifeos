// Forward-only migration runner. Applies numbered SQL files in order and records
// each in public.schema_migrations. Idempotent: already-applied files are skipped
// (docs/09_DATABASE_DESIGN.md §5).

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations');

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(
  connectionString: string,
  migrationsDir: string = MIGRATIONS_DIR,
): Promise<MigrationResult> {
  const client = new Client({ connectionString });
  await client.connect();
  const result: MigrationResult = { applied: [], skipped: [] };
  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    const { rows } = await client.query<{ version: string }>(
      'select version from public.schema_migrations',
    );
    const done = new Set(rows.map((r) => r.version));

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (done.has(version)) {
        result.skipped.push(version);
        continue;
      }
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (version) values ($1)', [version]);
        await client.query('commit');
        result.applied.push(version);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration ${version} failed: ${(error as Error).message}`, { cause: error });
      }
    }
    return result;
  } finally {
    await client.end();
  }
}

/** Latest applied migration version (the "Database version"), or null if none. */
export async function currentVersion(connectionString: string): Promise<string | null> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ version: string }>(
      'select version from public.schema_migrations order by version desc limit 1',
    );
    return rows[0]?.version ?? null;
  } finally {
    await client.end();
  }
}
