import type { DomainEvent, EventHandler } from '@lifeos/contracts';

export interface Subscription {
  /** Stable name used as the idempotency key prefix (docs/02 §14). */
  name: string;
  handler: EventHandler;
}

/** Routes event types to their (named) handlers. Subscribers register at startup. */
export class SubscriberRegistry {
  private readonly subscriptions = new Map<string, Subscription[]>();

  on(eventType: string, name: string, handler: EventHandler): void {
    const list = this.subscriptions.get(eventType) ?? [];
    list.push({ name, handler });
    this.subscriptions.set(eventType, list);
  }

  handlersFor(event: DomainEvent): Subscription[] {
    return this.subscriptions.get(event.type) ?? [];
  }
}
