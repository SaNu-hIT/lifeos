import type { DomainEvent } from '@lifeos/contracts';
import type { Tx } from '../database/database.port.js';

/** DI token for the EventBusPort. */
export const EVENT_BUS = Symbol('EVENT_BUS');

/**
 * Publishes domain events. `publish` MUST be called with the same transaction that
 * changes state, so the event and the state commit atomically (the Outbox pattern —
 * ADR-0008). A relay later moves outbox rows to the queue.
 */
export interface EventBusPort {
  publish(events: DomainEvent[], tx: Tx): Promise<void>;
}
