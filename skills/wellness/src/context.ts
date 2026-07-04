// Wellness's Context Provider — a light existence/recency check only (cheap on every
// turn). The heavy structured history lives behind the wellness.get_history_summary
// tool call, not here, so context assembly stays fast even for long-time users.

import type { ContextProvider, ContextRequest, UnifiedContext } from '@lifeos/contracts';
import { deriveCycles, lastFlowRunStart, predictNextCycle } from './domain/cycle.js';
import { dueSupplyReminders } from './domain/reminders.js';
import type { CycleEntryRepositoryPort } from './ports/cycle-entry.port.js';
import type { WellnessProfileRepositoryPort } from './ports/wellness-profile.port.js';
import type { ReminderRepositoryPort } from './ports/reminder.port.js';

export interface WellnessContextDeps {
  entries: CycleEntryRepositoryPort;
  profiles: WellnessProfileRepositoryPort;
  reminders: ReminderRepositoryPort;
  now: () => string;
}

export function createWellnessContextProvider(deps: WellnessContextDeps): ContextProvider {
  return {
    scope: 'wellness',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const nowIso = deps.now();
      const [entries, profile, pendingReminders] = await Promise.all([
        deps.entries.entriesInRange(request.userId, '0001-01-01', nowIso.slice(0, 10)),
        deps.profiles.getProfile(request.userId),
        deps.reminders.listPending(request.userId),
      ]);
      const cycles = deriveCycles(entries);
      const hasAnyHistory = cycles.length > 0 || entries.length > 0;
      const prediction = predictNextCycle(cycles, nowIso, profile?.averageCycleLengthDays, lastFlowRunStart(entries));
      const daysUntilPredictedPeriod = prediction
        ? Math.round((new Date(prediction.predictedNextStart).getTime() - new Date(nowIso).getTime()) / 86400000)
        : null;
      const due = dueSupplyReminders(profile?.supplyList ?? [], prediction, nowIso);

      return {
        settings: {
          wellness: {
            onboardingIncomplete: !profile && !hasAnyHistory,
            hasAnyHistory,
            daysUntilPredictedPeriod,
            pendingReminderCount: pendingReminders.length + due.length,
          },
        },
      };
    },
  };
}
