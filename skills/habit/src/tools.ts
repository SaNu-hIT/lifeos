// Habit tools — the units the Planner can call. Handlers close over injected ports
// only (ADR-0004: logic lives here, the AI never touches the DB directly).
// `get_summary` is deliberately data-only: it hands the LLM streaks/status so IT
// composes the nudge — no canned motivational copy lives here.

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type { Habit, HabitCheckIn, HabitFrequency, HabitSummary, HabitWithProgress } from './domain/types.js';
import { computeStreak, dueReminders, todayStatus } from './domain/streak.js';
import type { HabitRepositoryPort } from './ports/habit.port.js';
import type { HabitCheckInRepositoryPort } from './ports/habit-checkin.port.js';
import {
  HABIT_CHECKED_IN,
  HABIT_STREAK_MILESTONE,
  type HabitCheckedInPayload,
  type StreakMilestonePayload,
} from './surface.js';

const MILESTONES = new Set([7, 30, 100, 365]);

export interface HabitToolDeps {
  habits: HabitRepositoryPort;
  checkIns: HabitCheckInRepositoryPort;
  newId: () => string;
  /** Injected clock — no hidden "now" (docs/02 §8). Defaults to real time. */
  now?: () => string;
  publish?: (event: DomainEvent) => Promise<void>;
}

interface CreateHabitArgs {
  name: string;
  frequency: HabitFrequency;
  reminderTime?: string;
}
interface CheckInArgs {
  habitId: string;
  date?: string;
  done?: boolean;
  notes?: string;
}
interface DeleteHabitArgs {
  habitId: string;
}

async function buildProgress(
  deps: HabitToolDeps,
  habit: Habit,
  todayIso: string,
): Promise<HabitWithProgress> {
  const entries = await deps.checkIns.checkInsForHabit(habit.userId, habit.id);
  return {
    habit,
    streak: computeStreak(entries, habit.frequency, todayIso),
    todayStatus: todayStatus(entries, todayIso),
  };
}

export function createHabitTools(deps: HabitToolDeps): Tool[] {
  const { newId } = deps;
  const now = () => deps.now?.() ?? new Date().toISOString();

  const createHabit: Tool<CreateHabitArgs, { habitId: string }> = {
    name: 'habit.create_habit',
    description:
      'Define a new habit to track. frequency is daily, weekdays, or weekly. ' +
      'reminderTime is optional, "HH:MM" 24h local time.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        frequency: { type: 'string', enum: ['daily', 'weekdays', 'weekly'] },
        reminderTime: { type: 'string' },
      },
      required: ['name', 'frequency'],
    },
    outputSchema: { type: 'object', properties: { habitId: { type: 'string' } }, required: ['habitId'] },
    requiredCapability: 'habit.track',
    idempotent: false,
    requiresConfirmation: false,
    followUps: [{ label: 'View my habits', prompt: 'show my habits' }],
    handler: async (ctx: UnifiedContext, args: CreateHabitArgs) => {
      const habit: Habit = {
        id: newId(),
        userId: ctx.user.id,
        name: args.name,
        frequency: args.frequency,
        reminderTime: args.reminderTime,
        active: true,
        createdAt: now(),
        updatedAt: now(),
      };
      await deps.habits.createHabit(habit);
      return { habitId: habit.id };
    },
  };

  const checkIn: Tool<CheckInArgs, { streak: number; alreadyDone: boolean }> = {
    name: 'habit.check_in',
    description:
      'Mark a habit done (or not done) for a day. date defaults to today, done ' +
      'defaults to true. Idempotent per (habit, day) — checking the same day again ' +
      'just corrects it. Returns the resulting current streak.',
    inputSchema: {
      type: 'object',
      properties: {
        habitId: { type: 'string' },
        date: { type: 'string' },
        done: { type: 'boolean' },
        notes: { type: 'string' },
      },
      required: ['habitId'],
    },
    outputSchema: {
      type: 'object',
      properties: { streak: { type: 'integer' }, alreadyDone: { type: 'boolean' } },
      required: ['streak', 'alreadyDone'],
    },
    requiredCapability: 'habit.track',
    idempotent: true,
    requiresConfirmation: false,
    // Streak news is the reward for checking in — offer it, but only when there's
    // an actual streak to see (skip on a "not done" check-in).
    followUpsFor: (out) =>
      out.streak > 0 ? [{ label: 'View my streaks', prompt: 'how are my habits doing' }] : [],
    handler: async (ctx: UnifiedContext, args: CheckInArgs) => {
      const habit = await deps.habits.getHabit(ctx.user.id, args.habitId);
      if (!habit) throw new Error('habit not found');

      const date = (args.date ?? now()).slice(0, 10);
      const done = args.done ?? true;
      const priorEntries = await deps.checkIns.checkInsForHabit(ctx.user.id, args.habitId);
      const alreadyDone = priorEntries.some((e) => e.date === date && e.done);

      const entry: HabitCheckIn = {
        id: newId(),
        userId: ctx.user.id,
        habitId: args.habitId,
        date,
        done,
        notes: args.notes,
        createdAt: now(),
      };
      await deps.checkIns.upsertCheckIn(entry);

      const merged = [...priorEntries.filter((e) => e.date !== date), entry];
      const streak = computeStreak(merged, habit.frequency, now());

      if (deps.publish && done) {
        const payload: HabitCheckedInPayload = {
          habitId: habit.id,
          habitName: habit.name,
          date,
          currentStreak: streak.currentStreak,
        };
        await deps.publish({
          eventId: newId(),
          type: HABIT_CHECKED_IN,
          userId: ctx.user.id,
          occurredAt: entry.createdAt,
          payload,
        });
        if (MILESTONES.has(streak.currentStreak)) {
          const milestone: StreakMilestonePayload = {
            habitId: habit.id,
            habitName: habit.name,
            streak: streak.currentStreak,
          };
          await deps.publish({
            eventId: newId(),
            type: HABIT_STREAK_MILESTONE,
            userId: ctx.user.id,
            occurredAt: entry.createdAt,
            payload: milestone,
          });
        }
      }

      return { streak: streak.currentStreak, alreadyDone };
    },
  };

  const deleteHabit: Tool<DeleteHabitArgs, { deleted: true }> = {
    name: 'habit.delete_habit',
    description: 'Stop tracking a habit and remove its history.',
    inputSchema: {
      type: 'object',
      properties: { habitId: { type: 'string' } },
      required: ['habitId'],
    },
    outputSchema: { type: 'object', properties: { deleted: { type: 'boolean' } }, required: ['deleted'] },
    requiredCapability: 'habit.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: DeleteHabitArgs) => {
      await deps.habits.deleteHabit(ctx.user.id, args.habitId);
      return { deleted: true };
    },
  };

  const listHabits: Tool<Record<string, never>, { habits: HabitWithProgress[] }> = {
    name: 'habit.list_habits',
    description: 'List the active habits with their current streak and today\'s status.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { habits: { type: 'array' } }, required: ['habits'] },
    requiredCapability: 'habit.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const todayIso = now();
      const habits = await deps.habits.listHabits(ctx.user.id, { activeOnly: true });
      const withProgress = await Promise.all(habits.map((h) => buildProgress(deps, h, todayIso)));
      return { habits: withProgress };
    },
  };

  const getSummary: Tool<Record<string, never>, HabitSummary> = {
    name: 'habit.get_summary',
    description:
      'Fetch structured habit progress (per-habit current/longest streak, today\'s ' +
      'status, and any reminders now due). Returns DATA ONLY — it does not itself ' +
      'author encouragement; compose the reply using this data. If hasAnyHistory is ' +
      'false, offer to create a first habit instead of nudging.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object' },
    requiredCapability: 'habit.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const nowIso = now();
      const habits = await deps.habits.listHabits(ctx.user.id, { activeOnly: true });
      const withProgress = await Promise.all(habits.map((h) => buildProgress(deps, h, nowIso)));

      const checkInsByHabit = new Map<string, HabitCheckIn[]>();
      for (const hp of withProgress) {
        checkInsByHabit.set(hp.habit.id, await deps.checkIns.checkInsForHabit(ctx.user.id, hp.habit.id));
      }
      const due = dueReminders(habits, checkInsByHabit, nowIso);

      return {
        hasAnyHistory: withProgress.some((hp) => hp.streak.lastCheckedInDate != null),
        habits: withProgress,
        dueReminders: due,
      };
    },
  };

  return [createHabit, checkIn, deleteHabit, listHabits, getSummary];
}
