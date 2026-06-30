import type { DomainEvent } from '@lifeos/contracts';
import type { DedupeStore } from './dedupe.store.js';
import type { SubscriberRegistry } from './subscriber-registry.js';

/**
 * Delivers an event to each registered handler exactly once. Because delivery is
 * at-least-once (ADR-0008), every handler is guarded by the dedupe ledger: a handler
 * that already processed this event is skipped, and it is marked processed only after
 * it succeeds (so a failure is retried).
 */
export class IdempotentDispatcher {
  constructor(
    private readonly registry: SubscriberRegistry,
    private readonly dedupe: DedupeStore,
  ) {}

  async dispatch(event: DomainEvent): Promise<void> {
    for (const { name, handler } of this.registry.handlersFor(event)) {
      if (await this.dedupe.alreadyProcessed(name, event.eventId)) continue;
      await handler(event);
      await this.dedupe.markProcessed(name, event.eventId);
    }
  }
}
