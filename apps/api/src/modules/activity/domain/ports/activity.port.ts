import type { DomainEvent } from '@lifeos/contracts';

/** DI token for the ActivityEnginePort. */
export const ACTIVITY_ENGINE = Symbol('ACTIVITY_ENGINE');

export interface ActivityEntry {
  userId: string;
  kind: string;
  title: string;
  summary?: string;
  deepLink?: string;
  occurredAt: string;
}

export interface ActivityView extends ActivityEntry {
  id: string;
}

/** A Skill/engine-contributed projection: turns a domain event into a feed entry.
 *  Return null to skip. Registered as an idempotent subscriber. */
export interface ActivityProjection {
  key: string;
  on: string; // domain event type
  build(event: DomainEvent): ActivityEntry | null;
}

export interface ActivityPage {
  data: ActivityView[];
  nextCursor?: string;
}

export interface ActivityEnginePort {
  registerProjection(projection: ActivityProjection): void;
  getFeed(userId: string, page?: { limit?: number; cursor?: string }): Promise<ActivityPage>;
}
