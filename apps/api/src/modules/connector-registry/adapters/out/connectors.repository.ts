import type { DatabasePort } from '../../../../shared/database/database.port.js';

/** Persists which connectors are registered (no credentials). Service context. */
export class ConnectorsRepository {
  constructor(private readonly db: DatabasePort) {}

  async upsert(key: string, domain: string): Promise<void> {
    await this.db.query(
      `insert into catalog.connectors (key, domain, status) values ($1, $2, 'registered')
       on conflict (key) do update set domain = excluded.domain, status = 'registered', updated_at = now()`,
      [key, domain],
    );
  }
}
