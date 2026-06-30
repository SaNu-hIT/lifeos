import type { DomainEvent } from '@lifeos/contracts';
import type { EventQueue } from '../bullmq/event-queue.js';
import type { OutboxRepository } from './outbox.repository.js';

/** Moves unpublished outbox rows to the queue and marks them published. Enqueue
 *  happens before marking, so a crash in between yields at-least-once (safe — the
 *  consumer is idempotent). */
export class OutboxRelay {
  constructor(
    private readonly outbox: OutboxRepository,
    private readonly queue: EventQueue,
  ) {}

  /** One polling pass. Returns the number of rows relayed. */
  async runOnce(batchSize = 100): Promise<number> {
    const rows = await this.outbox.fetchUnpublished(batchSize);
    for (const row of rows) {
      const event: DomainEvent = {
        eventId: row.id,
        type: row.event_type,
        occurredAt: row.occurred_at,
        payload: row.payload,
      };
      await this.queue.add(event);
      await this.outbox.markPublished(row.id);
    }
    return rows.length;
  }
}
