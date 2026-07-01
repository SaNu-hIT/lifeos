import { afterAll, describe, expect, it } from 'vitest';
import type { ProviderHealth, ProviderPort } from '@lifeos/contracts';
import { ConnectorRegistry } from '../src/modules/connector-registry/connector-registry.js';
import { ConnectorsRepository } from '../src/modules/connector-registry/adapters/out/connectors.repository.js';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

const fakeRepo = { upsert: async () => undefined } as unknown as ConnectorsRepository;

function connector(key: string, domain: string, healthy: () => boolean): ProviderPort {
  return {
    key,
    domain,
    health: async (): Promise<ProviderHealth> => ({ healthy: healthy() }),
  };
}

describe('ConnectorRegistry (select + failover)', () => {
  it('registers and lists connectors by domain', () => {
    const r = new ConnectorRegistry(fakeRepo);
    r.register(connector('zepto', 'grocery', () => true));
    r.register(connector('blinkit', 'grocery', () => true));
    expect(r.list('grocery').map((c) => c.key).sort()).toEqual(['blinkit', 'zepto']);
    expect(() => r.register(connector('zepto', 'grocery', () => true))).toThrow(/already registered/);
  });

  it('selects a healthy connector and honors the preferred policy', async () => {
    const r = new ConnectorRegistry(fakeRepo);
    r.register(connector('zepto', 'grocery', () => true));
    r.register(connector('blinkit', 'grocery', () => true));
    expect((await r.select('grocery', { preferred: 'blinkit' })).key).toBe('blinkit');
    expect((await r.select('grocery')).key).toBeDefined();
  });

  it('fails over when the preferred connector is unhealthy', async () => {
    const r = new ConnectorRegistry(fakeRepo);
    r.register(connector('zepto', 'grocery', () => false)); // unhealthy
    r.register(connector('blinkit', 'grocery', () => true));
    const chosen = await r.select('grocery', { preferred: 'zepto' });
    expect(chosen.key).toBe('blinkit');
  });

  it('treats a throwing provider as unhealthy (bulkhead)', async () => {
    const r = new ConnectorRegistry(fakeRepo);
    r.register({
      key: 'flaky',
      domain: 'grocery',
      health: async () => {
        throw new Error('down');
      },
    });
    r.register(connector('blinkit', 'grocery', () => true));
    expect((await r.select('grocery')).key).toBe('blinkit');
  });

  it('throws when no connector / no healthy connector is available', async () => {
    const r = new ConnectorRegistry(fakeRepo);
    await expect(r.select('nope')).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    r.register(connector('zepto', 'grocery', () => false));
    await expect(r.select('grocery')).rejects.toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
  });
});

describe('ConnectorsRepository (persistence)', () => {
  it('upserts a connector row', async () => {
    await runMigrations(TEST_DB_URL);
    const db = new PgDatabaseAdapter(TEST_DB_URL);
    try {
      await new ConnectorsRepository(db).upsert('zepto', 'grocery');
      const row = await db.query("select domain from catalog.connectors where key = 'zepto'");
      expect(row.rows[0]).toEqual({ domain: 'grocery' });
    } finally {
      await db.query("delete from catalog.connectors where key = 'zepto'");
      await db.close();
    }
  });

  afterAll(() => undefined);
});
