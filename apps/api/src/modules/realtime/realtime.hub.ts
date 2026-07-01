import type { DomainEvent } from '@lifeos/contracts';

/** A message pushed to a connected client. Deliberately a projection of a DomainEvent —
 *  never the raw internal event (no eventId/outbox internals leak to clients). */
export interface RealtimeMessage {
  type: string;
  payload: unknown;
  occurredAt: string;
}

export type RealtimeListener = (message: RealtimeMessage) => void;

/**
 * In-memory per-user fan-out for live updates (phase 29). Fed by an event-dispatcher
 * tap; each connected client subscribes with its userId and receives that user's
 * events only — never another user's (the isolation boundary is userId). A distributed
 * transport (Redis pub/sub) can back this later without changing the controller.
 */
export class RealtimeHub {
  private readonly listeners = new Map<string, Set<RealtimeListener>>();

  /** Subscribe a client; returns an unsubscribe function. */
  subscribe(userId: string, listener: RealtimeListener): () => void {
    const set = this.listeners.get(userId) ?? new Set<RealtimeListener>();
    set.add(listener);
    this.listeners.set(userId, set);
    return () => {
      const current = this.listeners.get(userId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(userId);
    };
  }

  /** Number of live connections for a user (test/introspection aid). */
  connectionCount(userId: string): number {
    return this.listeners.get(userId)?.size ?? 0;
  }

  /** Fan an event out to the owning user's connections. User-less events are ignored
   *  (nothing to route them to); a throwing listener never affects the others. */
  publish(event: DomainEvent): void {
    if (!event.userId) return;
    const set = this.listeners.get(event.userId);
    if (!set || set.size === 0) return;
    const message: RealtimeMessage = {
      type: event.type,
      payload: event.payload,
      occurredAt: event.occurredAt,
    };
    for (const listener of set) {
      try {
        listener(message);
      } catch {
        // one bad connection must not block the rest
      }
    }
  }
}
