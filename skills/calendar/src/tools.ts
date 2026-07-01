// Calendar tools — the units the Planner can call. Same SDK path as Grocery, a wholly
// different domain: proof the platform generalises (ADR-0004: logic lives here).

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type { CalendarEvent, TimeSlot } from './domain/types.js';
import { findFreeSlot } from './domain/schedule.js';
import type { CalendarProviderPort } from './ports/calendar-provider.port.js';
import type { CalendarRepositoryPort } from './ports/calendar-repository.port.js';
import { CALENDAR_EVENT_SCHEDULED, type EventScheduledPayload } from './surface.js';

export interface CalendarToolDeps {
  repository: CalendarRepositoryPort;
  provider: CalendarProviderPort;
  newId: () => string;
  publish?: (event: DomainEvent) => Promise<void>;
}

interface ListArgs {
  from: string;
  to: string;
}
interface FindSlotArgs {
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
}
interface ScheduleArgs {
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string;
}

export function createCalendarTools(deps: CalendarToolDeps): Tool[] {
  const { newId } = deps;

  const listEvents: Tool<ListArgs, { events: CalendarEvent[] }> = {
    name: 'calendar.list_events',
    inputSchema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
      required: ['from', 'to'],
    },
    outputSchema: { type: 'object', properties: { events: { type: 'array' } }, required: ['events'] },
    requiredCapability: 'calendar.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: ListArgs) => ({
      events: await deps.provider.listEvents(ctx.user.id, args.from, args.to),
    }),
  };

  const findSlot: Tool<FindSlotArgs, { slot: TimeSlot | null }> = {
    name: 'calendar.find_slot',
    inputSchema: {
      type: 'object',
      properties: {
        windowStart: { type: 'string' },
        windowEnd: { type: 'string' },
        durationMinutes: { type: 'integer' },
      },
      required: ['windowStart', 'windowEnd', 'durationMinutes'],
    },
    outputSchema: { type: 'object', properties: { slot: {} }, required: ['slot'] },
    requiredCapability: 'calendar.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: FindSlotArgs) => {
      const busy = await deps.provider.listEvents(ctx.user.id, args.windowStart, args.windowEnd);
      return { slot: findFreeSlot(busy, args.windowStart, args.windowEnd, args.durationMinutes) };
    },
  };

  const scheduleEvent: Tool<ScheduleArgs, { eventId: string; providerEventId?: string }> = {
    name: 'calendar.schedule_event',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startsAt: { type: 'string' },
        endsAt: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['title', 'startsAt', 'endsAt'],
    },
    outputSchema: {
      type: 'object',
      properties: { eventId: { type: 'string' }, providerEventId: { type: 'string' } },
      required: ['eventId'],
    },
    requiredCapability: 'calendar.write',
    idempotent: false,
    requiresConfirmation: true, // writing to the user's calendar is user-visible
    handler: async (ctx: UnifiedContext, args: ScheduleArgs) => {
      if (new Date(args.endsAt).getTime() <= new Date(args.startsAt).getTime()) {
        throw new Error('event end must be after its start');
      }
      const draft: CalendarEvent = {
        id: newId(),
        userId: ctx.user.id,
        title: args.title,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        location: args.location,
      };
      const created = await deps.provider.createEvent(ctx.user.id, draft);
      const event: CalendarEvent = { ...draft, providerEventId: created.providerEventId };
      await deps.repository.saveEvent(event);

      if (deps.publish) {
        const payload: EventScheduledPayload = {
          eventId: event.id,
          title: event.title,
          startsAt: event.startsAt,
        };
        await deps.publish({
          eventId: newId(),
          type: CALENDAR_EVENT_SCHEDULED,
          userId: ctx.user.id,
          occurredAt: ctx.now,
          payload,
        });
      }
      return { eventId: event.id, providerEventId: event.providerEventId };
    },
  };

  return [listEvents, findSlot, scheduleEvent];
}
