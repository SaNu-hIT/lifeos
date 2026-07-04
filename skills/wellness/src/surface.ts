// Wellness's surface contributions — feed, notifications, and a "Cycle" home widget.
// Declarative; installed by the SkillHost. No platform imports (ADR-0001).

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import { deriveCycles, lastFlowRunStart, predictNextCycle } from './domain/cycle.js';
import { dueSupplyReminders } from './domain/reminders.js';
import type { CycleEntryRepositoryPort } from './ports/cycle-entry.port.js';
import type { WellnessProfileRepositoryPort } from './ports/wellness-profile.port.js';
import type { ReminderRepositoryPort } from './ports/reminder.port.js';

export const WELLNESS_REMINDER_DUE = 'wellness.reminder_due';
export const WELLNESS_CYCLE_LOGGED = 'wellness.cycle_logged';

export interface ReminderDuePayload {
  reminderId: string;
  label: string;
  dueDate: string;
}

export interface CycleLoggedPayload {
  start: string;
  end: string;
  lengthDays: number;
}

export function createWellnessReminderActivityProjection(): ActivityProjection {
  return {
    key: 'wellness.reminder_due',
    on: WELLNESS_REMINDER_DUE,
    build: (event: DomainEvent) => {
      const p = event.payload as ReminderDuePayload;
      return {
        userId: event.userId!,
        kind: WELLNESS_REMINDER_DUE,
        title: 'Reminder',
        summary: `${p.label} — due ${p.dueDate}`,
        deepLink: `/wellness/reminders/${p.reminderId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createWellnessCycleActivityProjection(): ActivityProjection {
  return {
    key: 'wellness.cycle_logged',
    on: WELLNESS_CYCLE_LOGGED,
    build: (event: DomainEvent) => {
      const p = event.payload as CycleLoggedPayload;
      return {
        userId: event.userId!,
        kind: WELLNESS_CYCLE_LOGGED,
        title: 'Period ended',
        summary: `${p.lengthDays} day${p.lengthDays === 1 ? '' : 's'}`,
        deepLink: `/wellness`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createWellnessReminderNotification(): NotificationDeclaration {
  return {
    key: 'wellness.reminder_due',
    on: WELLNESS_REMINDER_DUE,
    build: (event: DomainEvent) => {
      const p = event.payload as ReminderDuePayload;
      return {
        userId: event.userId!,
        kind: WELLNESS_REMINDER_DUE,
        title: 'Reminder',
        body: `${p.label} — due ${p.dueDate}`,
        importance: 'normal',
        channels: ['in_app'],
        deepLink: `/wellness/reminders/${p.reminderId}`,
        dedupeKey: `wellness.reminder.${p.reminderId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface WellnessWidgetDeps {
  entries: CycleEntryRepositoryPort;
  profiles: WellnessProfileRepositoryPort;
  reminders: ReminderRepositoryPort;
  /** Injected "now" — no hidden clocks (docs/02 §8). */
  now: () => string;
}

/** Home widget: "Cycle" — predicted next start, days until, pending reminder count.
 *  Hides entirely for brand-new users with zero history (same as Workout's widget). */
export function createWellnessWidgets(deps: WellnessWidgetDeps): WidgetContribution[] {
  return [
    {
      key: 'wellness.cycle',
      title: 'Cycle',
      requiredCapability: 'wellness.read',
      priority: 25,
      build: async (ctx) => {
        const nowIso = deps.now();
        const [entries, profile, pendingReminders] = await Promise.all([
          deps.entries.entriesInRange(ctx.userId, '0001-01-01', nowIso.slice(0, 10)),
          deps.profiles.getProfile(ctx.userId),
          deps.reminders.listPending(ctx.userId),
        ]);
        const cycles = deriveCycles(entries);
        if (cycles.length === 0 && entries.length === 0) return null;

        const prediction = predictNextCycle(cycles, nowIso, profile?.averageCycleLengthDays, lastFlowRunStart(entries));
        const daysUntil = prediction
          ? Math.round((new Date(prediction.predictedNextStart).getTime() - new Date(nowIso).getTime()) / 86400000)
          : null;
        const due = dueSupplyReminders(profile?.supplyList ?? [], prediction, nowIso);

        return {
          urgency: daysUntil != null && daysUntil <= 3 ? 0.6 : 0.2,
          asOf: nowIso,
          props: {
            predictedNextStart: prediction?.predictedNextStart ?? null,
            daysUntilPredictedPeriod: daysUntil,
            pendingReminderCount: pendingReminders.length + due.length,
          },
        };
      },
    },
  ];
}
