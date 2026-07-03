// @lifeos/skill-calendar — Skill #2. A second, unrelated Skill proving the platform
// generalises: same SDK path as Grocery (tools, context provider, surfaces, connector),
// wholly different domain, zero core changes (docs/01 §2, ADR-0001).

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createCalendarTools, type CalendarToolDeps } from './tools.js';
import { createCalendarContextProvider } from './context.js';
import {
  createCalendarActivityProjection,
  createCalendarNotification,
  createCalendarWidgets,
} from './surface.js';

export interface CalendarSkillDeps extends CalendarToolDeps {
  /** Injected clock for context/widgets — no hidden time (docs/02 §8). */
  now: () => string;
}

export function createCalendarSkill(deps: CalendarSkillDeps): SkillManifest {
  return defineSkill({
    key: 'calendar',
    version: '1.0.0',
    title: 'Calendar',
    description: 'View your schedule, find free time slots, and create calendar events.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'calendar.read', description: 'View events and find free slots' },
      { key: 'calendar.write', description: 'Schedule calendar events' },
    ],
    tools: createCalendarTools(deps),
    contextProviders: [
      createCalendarContextProvider({ repository: deps.repository, now: deps.now }),
    ],
    activityProjections: [createCalendarActivityProjection()],
    notifications: [createCalendarNotification()],
    widgets: createCalendarWidgets({ repository: deps.repository, now: deps.now }),
  });
}

export * from './domain/types.js';
export * from './domain/schedule.js';
export type { CalendarProviderPort, CreatedEvent } from './ports/calendar-provider.port.js';
export type { CalendarRepositoryPort } from './ports/calendar-repository.port.js';
export { createCalendarTools, type CalendarToolDeps } from './tools.js';
export { createCalendarContextProvider, type CalendarContextDeps } from './context.js';
export { runCalendarProviderContractTests } from './provider-contract.js';
export {
  CALENDAR_EVENT_SCHEDULED,
  createCalendarActivityProjection,
  createCalendarNotification,
  createCalendarWidgets,
  type EventScheduledPayload,
  type CalendarWidgetDeps,
} from './surface.js';
