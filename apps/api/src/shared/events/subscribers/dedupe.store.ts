import type { DatabasePort } from '../../database/database.port.js';

/** Durable record of which (handler, event) pairs have been processed. */
export class DedupeStore {
  constructor(private readonly db: DatabasePort) {}

  async alreadyProcessed(handler: string, eventId: string): Promise<boolean> {
    const result = await this.db.query(
      'select 1 from platform.processed_events where handler = $1 and event_id = $2',
      [handler, eventId],
    );
    return result.rowCount > 0;
  }

  async markProcessed(handler: string, eventId: string): Promise<void> {
    await this.db.query(
      `insert into platform.processed_events (handler, event_id)
       values ($1, $2) on conflict do nothing`,
      [handler, eventId],
    );
  }
}
