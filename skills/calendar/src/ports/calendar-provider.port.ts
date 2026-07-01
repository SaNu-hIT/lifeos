// The domain-shaped provider port Calendar depends on. Real connectors (Google
// Calendar, Outlook …) implement this; the Skill never knows which one runs (ADR-0005).

import type { ProviderPort } from '@lifeos/contracts';
import type { CalendarEvent } from '../domain/types.js';

export interface CreatedEvent {
  providerEventId: string;
}

export interface CalendarProviderPort extends ProviderPort {
  readonly domain: 'calendar';
  listEvents(userId: string, from: string, to: string): Promise<CalendarEvent[]>;
  createEvent(userId: string, event: Omit<CalendarEvent, 'providerEventId'>): Promise<CreatedEvent>;
}
