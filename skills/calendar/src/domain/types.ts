// Calendar domain model. A second, unrelated Skill — proof the platform is not
// grocery-shaped (docs/01 §2, ADR-0001). Times are ISO-8601 strings; no hidden clocks.

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  startsAt: string; // ISO-8601
  endsAt: string; // ISO-8601
  location?: string;
  providerEventId?: string;
}

/** A free window a meeting could be scheduled into. */
export interface TimeSlot {
  startsAt: string;
  endsAt: string;
}
