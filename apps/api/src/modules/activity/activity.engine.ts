import type { SubscriberRegistry } from '../../shared/events/subscribers/subscriber-registry.js';
import type {
  ActivityEnginePort,
  ActivityPage,
  ActivityProjection,
} from './domain/ports/activity.port.js';
import type { ActivityRepository } from './adapters/out/activity.repository.js';

const DEFAULT_LIMIT = 50;

/**
 * Builds the append-only activity feed from domain events (CQRS, ADR-0008). Each
 * projection is registered as a NAMED subscriber, so the idempotent dispatcher
 * (phase-06) guarantees exactly-once effect despite at-least-once delivery.
 */
export class ActivityEngine implements ActivityEnginePort {
  constructor(
    private readonly repo: ActivityRepository,
    private readonly subscribers: SubscriberRegistry,
  ) {}

  registerProjection(projection: ActivityProjection): void {
    this.subscribers.on(projection.on, `activity:${projection.key}`, async (event) => {
      const entry = projection.build(event);
      if (entry) await this.repo.insert(entry);
    });
  }

  getFeed(userId: string, page?: { limit?: number; cursor?: string }): Promise<ActivityPage> {
    return this.repo.feed(userId, Math.min(page?.limit ?? DEFAULT_LIMIT, 100), page?.cursor);
  }
}
