// Calendar's own persistence port (the Skill defines the shape; a DB-backed adapter
// is injected at composition). Tested against an in-memory fake.

import type { CalendarEvent } from '../domain/types.js';

export interface CalendarRepositoryPort {
  saveEvent(event: CalendarEvent): Promise<void>;
  getEvent(userId: string, eventId: string): Promise<CalendarEvent | undefined>;
  /** Upcoming events at/after `from`, soonest first. */
  upcomingEvents(userId: string, from: string, limit: number): Promise<CalendarEvent[]>;
}
