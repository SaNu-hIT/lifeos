// Habit's Context Provider — a light existence/recency check only (cheap on every
// turn). The heavy per-habit streak breakdown lives behind the habit.get_summary
// tool call, not here, so context assembly stays fast.

import type { ContextProvider, ContextRequest, UnifiedContext } from '@lifeos/contracts';
import { dueReminders, todayStatus } from './domain/streak.js';
import type { HabitRepositoryPort } from './ports/habit.port.js';
import type { HabitCheckInRepositoryPort } from './ports/habit-checkin.port.js';
import type { HabitCheckIn } from './domain/types.js';

export interface HabitContextDeps {
  habits: HabitRepositoryPort;
  checkIns: HabitCheckInRepositoryPort;
  now: () => string;
}

export function createHabitContextProvider(deps: HabitContextDeps): ContextProvider {
  return {
    scope: 'habit',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const nowIso = deps.now();
      const todayIso = nowIso.slice(0, 10);
      const [habits, todayEntries] = await Promise.all([
        deps.habits.listHabits(request.userId, { activeOnly: true }),
        deps.checkIns.checkInsForDate(request.userId, todayIso),
      ]);

      const byHabit = new Map<string, HabitCheckIn[]>();
      for (const e of todayEntries) byHabit.set(e.habitId, [...(byHabit.get(e.habitId) ?? []), e]);

      const pendingToday = habits.filter((h) => todayStatus(byHabit.get(h.id) ?? [], nowIso) !== 'done').length;
      const due = dueReminders(habits, byHabit, nowIso);

      return {
        settings: {
          habit: {
            hasAnyHabits: habits.length > 0,
            activeHabitCount: habits.length,
            pendingTodayCount: pendingToday,
            dueReminderCount: due.length,
          },
        },
      };
    },
  };
}
