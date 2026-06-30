import type { DomainEvent } from '@lifeos/contracts';
import type { Tx } from '../database/database.port.js';
import type { EventBusPort } from './event-bus.port.js';
import type { OutboxRepository } from './outbox/outbox.repository.js';

/** EventBus backed by the transactional outbox (ADR-0008). */
export class PgEventBus implements EventBusPort {
  constructor(private readonly outbox: OutboxRepository) {}

  async publish(events: DomainEvent[], tx: Tx): Promise<void> {
    if (events.length === 0) return;
    await this.outbox.insert(tx, events);
  }
}
