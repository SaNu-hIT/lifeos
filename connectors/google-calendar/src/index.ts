// @lifeos/connector-google-calendar — a real-shaped Calendar connector. Implements the
// domain CalendarProviderPort and would map to the Google Calendar API; here it runs
// against an in-memory store so the path is exercised without OAuth (deferred infra).
// Depends only on the SDK + the calendar domain contract, never on the platform core.

import type { ProviderHealth } from '@lifeos/contracts';
import { defineConnector } from '@lifeos/provider-sdk';
import type {
  CalendarEvent,
  CalendarProviderPort,
  CreatedEvent,
} from '@lifeos/skill-calendar';

function ms(iso: string): number {
  return new Date(iso).getTime();
}

export function createGoogleCalendarConnector(seed: CalendarEvent[] = []): CalendarProviderPort {
  const store: CalendarEvent[] = [...seed];
  let sequence = 0;
  return defineConnector<CalendarProviderPort>({
    key: 'google_calendar',
    domain: 'calendar',
    async health(): Promise<ProviderHealth> {
      return { healthy: true };
    },
    async listEvents(userId: string, from: string, to: string): Promise<CalendarEvent[]> {
      const fromMs = ms(from);
      const toMs = ms(to);
      return store
        .filter((e) => e.userId === userId && ms(e.startsAt) < toMs && ms(e.endsAt) > fromMs)
        .sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
    },
    async createEvent(
      userId: string,
      event: Omit<CalendarEvent, 'providerEventId'>,
    ): Promise<CreatedEvent> {
      sequence += 1;
      const providerEventId = `gcal-${userId}-${sequence}`;
      store.push({ ...event, providerEventId });
      return { providerEventId };
    },
  });
}

export const googleCalendarConnector = createGoogleCalendarConnector();
