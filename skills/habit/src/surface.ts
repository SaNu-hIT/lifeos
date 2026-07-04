// Habit's surface contributions — feed, notifications, and a "Habits" home widget.
// Declarative; installed by the SkillHost. No platform imports (ADR-0001).

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import { computeStreak, todayStatus } from './domain/streak.js';
import type { HabitRepositoryPort } from './ports/habit.port.js';
import type { HabitCheckInRepositoryPort } from './ports/habit-checkin.port.js';

export const HABIT_CHECKED_IN = 'habit.checked_in';
export const HABIT_STREAK_MILESTONE = 'habit.streak_milestone';

export interface HabitCheckedInPayload {
  habitId: string;
  habitName: string;
  date: string;
  currentStreak: number;
}

export interface StreakMilestonePayload {
  habitId: string;
  habitName: string;
  streak: number;
}

export function createHabitCheckedInActivityProjection(): ActivityProjection {
  return {
    key: 'habit.checked_in',
    on: HABIT_CHECKED_IN,
    build: (event: DomainEvent) => {
      const p = event.payload as HabitCheckedInPayload;
      return {
        userId: event.userId!,
        kind: HABIT_CHECKED_IN,
        title: 'Habit done',
        summary: `${p.habitName} — ${p.currentStreak} day streak`,
        deepLink: `/habits/${p.habitId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createHabitMilestoneActivityProjection(): ActivityProjection {
  return {
    key: 'habit.streak_milestone',
    on: HABIT_STREAK_MILESTONE,
    build: (event: DomainEvent) => {
      const p = event.payload as StreakMilestonePayload;
      return {
        userId: event.userId!,
        kind: HABIT_STREAK_MILESTONE,
        title: 'Streak milestone',
        summary: `${p.habitName} — ${p.streak} days!`,
        deepLink: `/habits/${p.habitId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createHabitMilestoneNotification(): NotificationDeclaration {
  return {
    key: 'habit.streak_milestone',
    on: HABIT_STREAK_MILESTONE,
    build: (event: DomainEvent) => {
      const p = event.payload as StreakMilestonePayload;
      return {
        userId: event.userId!,
        kind: HABIT_STREAK_MILESTONE,
        title: 'Streak milestone 🎉',
        body: `${p.habitName} is on a ${p.streak}-day streak. Keep it going!`,
        importance: 'normal',
        channels: ['in_app'],
        deepLink: `/habits/${p.habitId}`,
        dedupeKey: `habit.milestone.${p.habitId}.${p.streak}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface HabitWidgetDeps {
  habits: HabitRepositoryPort;
  checkIns: HabitCheckInRepositoryPort;
  /** Injected "now" — no hidden clocks (docs/02 §8). */
  now: () => string;
}

/** Home widget: "Habits" — how many are still pending today and the best current
 *  streak. Hides entirely when the user has no habits (same as Workout/Wellness). */
export function createHabitWidgets(deps: HabitWidgetDeps): WidgetContribution[] {
  return [
    {
      key: 'habit.today',
      title: 'Habits',
      requiredCapability: 'habit.read',
      priority: 28,
      build: async (ctx) => {
        const nowIso = deps.now();
        const habits = await deps.habits.listHabits(ctx.userId, { activeOnly: true });
        if (habits.length === 0) return null;

        let pendingToday = 0;
        let bestStreak = 0;
        for (const habit of habits) {
          const entries = await deps.checkIns.checkInsForHabit(ctx.userId, habit.id);
          if (todayStatus(entries, nowIso) !== 'done') pendingToday += 1;
          bestStreak = Math.max(bestStreak, computeStreak(entries, habit.frequency, nowIso).currentStreak);
        }

        return {
          urgency: pendingToday > 0 ? 0.5 : 0.2,
          asOf: nowIso,
          props: {
            activeHabitCount: habits.length,
            pendingTodayCount: pendingToday,
            bestCurrentStreak: bestStreak,
          },
        };
      },
    },
  ];
}
