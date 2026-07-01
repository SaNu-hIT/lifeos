import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import type {
  CapabilityKey,
  PermissionDecision,
  PermissionPort,
  SkillManifest,
  Tool,
  UnifiedContext,
} from '@lifeos/contracts';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { ToolRegistry } from '../src/modules/tool-registry/tool-registry.js';
import { SchemaValidator } from '../src/modules/tool-registry/schema-validator.js';
import type { AuditLog } from '../src/shared/audit/audit-log.js';
import { SkillsRepository } from '../src/modules/skill-registry/adapters/out/skills.repository.js';
import { SkillRegistry } from '../src/modules/skill-registry/skill-registry.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

async function ensureDatabase(url: string): Promise<void> {
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [dbName]);
    if (!rowCount) await client.query(`create database ${dbName}`);
  } finally {
    await client.end();
  }
}

const allowAll: PermissionPort = {
  can: async (): Promise<PermissionDecision> => ({ allow: true }),
  capabilitiesFor: async () => ['sample.use'] as CapabilityKey[],
};
const noopAudit = { record: async () => undefined } as unknown as AuditLog;

const schema = { type: 'object' as const, properties: { text: { type: 'string' as const } }, required: ['text'] };
function sampleManifest(contractVersion = '^0.6.0'): SkillManifest {
  const echo: Tool = {
    name: 'sample.echo',
    inputSchema: schema,
    outputSchema: schema,
    requiredCapability: 'sample.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_c: UnifiedContext, args: unknown) => args,
  };
  return {
    key: 'sample',
    version: '1.0.0',
    contractVersion,
    capabilities: [{ key: 'sample.use', description: 'x' }],
    tools: [echo],
  };
}

function ctx(): UnifiedContext {
  return {
    user: { id: 'u-sample', locale: 'en', timezone: 'UTC' },
    capabilities: ['sample.use'],
    conversation: { id: 'c', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'sample',
    now: '2026-06-30T00:00:00Z',
  };
}

describe('Phase 10 — skill registry (integration)', () => {
  let db: PgDatabaseAdapter;
  let tools: ToolRegistry;
  let registry: SkillRegistry;
  const userId = randomUUID();

  beforeAll(async () => {
    await ensureDatabase(TEST_DB_URL);
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    tools = new ToolRegistry(allowAll, noopAudit, new SchemaValidator(), 'secret');
    registry = new SkillRegistry(tools, new SkillsRepository(db));
    await db.query('insert into platform.users (id, email) values ($1, $2)', [
      userId,
      `skill_${userId}@test.local`,
    ]);
  });

  afterAll(async () => {
    await db.query("delete from catalog.user_skills where skill_key = 'sample'");
    await db.query("delete from catalog.skills where key = 'sample'");
    await db.query('delete from platform.users where id = $1', [userId]);
    await db.close();
  });

  it('registers a manifest, forwards its tool, and persists a summary', async () => {
    await registry.register(sampleManifest());

    // Tool is now executable through the Tool Registry.
    expect(tools.get('sample.echo')).toBeDefined();
    const res = await tools.execute('sample.echo', ctx(), { text: 'hi' });
    expect(res).toEqual({ status: 'ok', output: { text: 'hi' } });

    // Descriptor + persistence.
    expect(registry.get('sample')?.toolNames).toEqual(['sample.echo']);
    const row = await db.query("select version from catalog.skills where key = 'sample'");
    expect(row.rowCount).toBe(1);
  });

  it('refuses a Skill targeting an incompatible platform contract', async () => {
    const otherTools = new ToolRegistry(allowAll, noopAudit, new SchemaValidator(), 'secret');
    const otherRegistry = new SkillRegistry(otherTools, new SkillsRepository(db));
    await expect(otherRegistry.register(sampleManifest('^99.0.0'))).rejects.toThrow(
      /targets contract \^99\.0\.0/,
    );
  });

  it('enable/disable is per-user and rejects unknown skills', async () => {
    await registry.setEnabled(userId, 'sample', false);
    const row = await db.query<{ enabled: boolean }>(
      'select enabled from catalog.user_skills where user_id = $1 and skill_key = $2',
      [userId, 'sample'],
    );
    expect(row.rows[0]?.enabled).toBe(false);
    await expect(registry.setEnabled(userId, 'nope', true)).rejects.toThrow(/unknown skill/);
  });
});
