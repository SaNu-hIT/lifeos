// The Calendar Context Provider — surfaces the user's upcoming schedule into the
// Unified Context so the Planner can reason about availability ("am I free tomorrow?").
// Reads through the repository port; contributes only to the open `settings` field.

import type { ContextProvider, ContextRequest, UnifiedContext } from '@lifeos/contracts';
import type { CalendarRepositoryPort } from './ports/calendar-repository.port.js';

export interface CalendarContextDeps {
  repository: CalendarRepositoryPort;
  now: () => string;
  lookaheadCount?: number;
}

export function createCalendarContextProvider(deps: CalendarContextDeps): ContextProvider {
  const limit = deps.lookaheadCount ?? 5;
  return {
    scope: 'calendar',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const upcoming = await deps.repository.upcomingEvents(request.userId, deps.now(), limit);
      return {
        settings: {
          calendar: {
            upcomingCount: upcoming.length,
            nextEvent: upcoming[0]
              ? { title: upcoming[0].title, startsAt: upcoming[0].startsAt }
              : null,
          },
        },
      };
    },
  };
}
