// Calendar's surface contributions — feed, notification and home widget on scheduling
// an event. Declarative; installed by the SkillHost (phase 22). No platform imports.

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import type { CalendarRepositoryPort } from './ports/calendar-repository.port.js';

export const CALENDAR_EVENT_SCHEDULED = 'calendar.event_scheduled';

export interface EventScheduledPayload {
  eventId: string;
  title: string;
  startsAt: string;
}

export function createCalendarActivityProjection(): ActivityProjection {
  return {
    key: 'calendar.event_scheduled',
    on: CALENDAR_EVENT_SCHEDULED,
    build: (event: DomainEvent) => {
      const p = event.payload as EventScheduledPayload;
      return {
        userId: event.userId!,
        kind: CALENDAR_EVENT_SCHEDULED,
        title: 'Scheduled an event',
        summary: `${p.title} @ ${p.startsAt}`,
        deepLink: `/calendar/events/${p.eventId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createCalendarNotification(): NotificationDeclaration {
  return {
    key: 'calendar.event_scheduled',
    on: CALENDAR_EVENT_SCHEDULED,
    build: (event: DomainEvent) => {
      const p = event.payload as EventScheduledPayload;
      return {
        userId: event.userId!,
        kind: CALENDAR_EVENT_SCHEDULED,
        title: 'Event added to your calendar',
        body: `${p.title} — ${p.startsAt}`,
        importance: 'normal',
        channels: ['in_app'],
        deepLink: `/calendar/events/${p.eventId}`,
        dedupeKey: `calendar.event.${p.eventId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface CalendarWidgetDeps {
  repository: CalendarRepositoryPort;
  /** Injected "now" so the widget has no hidden clock (docs/02 §8). */
  now: () => string;
  lookaheadCount?: number;
}

/** Home widget: "Up next" — the user's soonest upcoming events. Hides when empty. */
export function createCalendarWidgets(deps: CalendarWidgetDeps): WidgetContribution[] {
  const limit = deps.lookaheadCount ?? 3;
  return [
    {
      key: 'calendar.up_next',
      title: 'Up next',
      requiredCapability: 'calendar.read',
      priority: 30,
      build: async (ctx) => {
        const events = await deps.repository.upcomingEvents(ctx.userId, deps.now(), limit);
        if (events.length === 0) return null;
        const soonest = events[0]!;
        return {
          urgency: 0.5,
          asOf: soonest.startsAt,
          props: {
            events: events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt })),
          },
        };
      },
    },
  ];
}
