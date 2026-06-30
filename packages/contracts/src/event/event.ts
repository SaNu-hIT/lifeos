// Domain events propagate cross-cutting effects reliably via the outbox
// (docs/adr/adr-0008-event-driven-outbox.md). Skills cooperate through events,
// never direct calls.

export interface DomainEvent<P = unknown> {
  eventId: string;
  /** `<context>.<thing>_<pastTense>`, e.g. `grocery.order_placed`. */
  type: string;
  userId?: string;
  /** ISO-8601 timestamp. */
  occurredAt: string;
  payload: P;
}

export type EventHandler<P = unknown> = (event: DomainEvent<P>) => Promise<void>;
