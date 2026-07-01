import type { DomainEvent } from '@lifeos/contracts';
import type { DedupeStore } from './dedupe.store.js';
import type { SubscriberRegistry } from './subscriber-registry.js';

/** An ephemeral observer of every dispatched event — NOT idempotency-guarded and NOT
 *  allowed to fail the dispatch. Used by the realtime layer (phase 29) to fan events
 *  out to connected clients; it is fire-and-forget by design. */
export type EventTap = (event: DomainEvent) => void;

/**
 * Delivers an event to each registered handler exactly once. Because delivery is
 * at-least-once (ADR-0008), every handler is guarded by the dedupe ledger: a handler
 * that already processed this event is skipped, and it is marked processed only after
 * it succeeds (so a failure is retried).
 */
export class IdempotentDispatcher {
  private readonly taps: EventTap[] = [];

  constructor(
    private readonly registry: SubscriberRegistry,
    private readonly dedupe: DedupeStore,
  ) {}

  /** Register an ephemeral observer invoked for every dispatched event. */
  registerTap(tap: EventTap): void {
    this.taps.push(tap);
  }

  async dispatch(event: DomainEvent): Promise<void> {
    // Taps first, isolated: a live-stream push must never break durable delivery.
    for (const tap of this.taps) {
      try {
        tap(event);
      } catch {
        // swallow — realtime is best-effort
      }
    }
    for (const { name, handler } of this.registry.handlersFor(event)) {
      if (await this.dedupe.alreadyProcessed(name, event.eventId)) continue;
      await handler(event);
      await this.dedupe.markProcessed(name, event.eventId);
    }
  }
}
