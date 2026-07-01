import type { ActivityEntry, ActivityProjection } from '@lifeos/contracts';

export type { ActivityEntry, ActivityProjection };

/** DI token for the ActivityEnginePort. */
export const ACTIVITY_ENGINE = Symbol('ACTIVITY_ENGINE');

export interface ActivityView extends ActivityEntry {
  id: string;
}

export interface ActivityPage {
  data: ActivityView[];
  nextCursor?: string;
}

export interface ActivityEnginePort {
  registerProjection(projection: ActivityProjection): void;
  getFeed(userId: string, page?: { limit?: number; cursor?: string }): Promise<ActivityPage>;
}
