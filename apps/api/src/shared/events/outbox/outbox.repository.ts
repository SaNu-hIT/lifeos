import type { DomainEvent } from '@lifeos/contracts';
import type { DatabasePort, Tx } from '../../database/database.port.js';

export interface OutboxRow {
  id: string;
  aggregate: string;
  event_type: string;
  payload: unknown;
  occurred_at: string;
}

export class OutboxRepository {
  constructor(private readonly db: DatabasePort) {}

  /** Insert events into the outbox within the caller's transaction (atomic with state). */
  async insert(tx: Tx, events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      const aggregate = event.type.split('.')[0] ?? 'unknown';
      await tx.query(
        `insert into platform.outbox (id, aggregate, event_type, payload, occurred_at)
         values ($1, $2, $3, $4, $5)`,
        [event.eventId, aggregate, event.type, JSON.stringify(event.payload), event.occurredAt],
      );
    }
  }

  /** Fetch a batch of not-yet-published rows, oldest first. */
  async fetchUnpublished(limit: number): Promise<OutboxRow[]> {
    const result = await this.db.query<OutboxRow>(
      `select id, aggregate, event_type, payload, occurred_at
         from platform.outbox
        where published_at is null
        order by occurred_at
        limit $1`,
      [limit],
    );
    return result.rows;
  }

  async markPublished(id: string): Promise<void> {
    await this.db.query('update platform.outbox set published_at = now() where id = $1', [id]);
  }
}
