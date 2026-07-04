// Wellness tools — the units the Planner can call. Handlers close over injected
// ports only (ADR-0004). `get_history_summary` is data-only: it hands the LLM clean
// structured cycle/symptom/prediction data so IT composes an insight in chat — no
// canned advice lives here (same product requirement as Workout's get_history_summary).

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type {
  CycleDayEntry,
  CyclePrediction,
  FlowIntensity,
  Reminder,
  RecentCycleSummary,
  SupplyItem,
  TrackingGoal,
  WellnessHistorySummary,
  WellnessProfile,
} from './domain/types.js';
import { deriveCycles, lastFlowRunStart, predictNextCycle } from './domain/cycle.js';
import { dueSupplyReminders } from './domain/reminders.js';
import type { CycleEntryRepositoryPort } from './ports/cycle-entry.port.js';
import type { WellnessProfileRepositoryPort } from './ports/wellness-profile.port.js';
import type { ReminderRepositoryPort } from './ports/reminder.port.js';
import { WELLNESS_REMINDER_DUE, type ReminderDuePayload } from './surface.js';

export interface WellnessToolDeps {
  entries: CycleEntryRepositoryPort;
  profiles: WellnessProfileRepositoryPort;
  reminders: ReminderRepositoryPort;
  newId: () => string;
  /** Injected clock — no hidden "now" (docs/02 §8). Defaults to real time. */
  now?: () => string;
  publish?: (event: DomainEvent) => Promise<void>;
}

interface LogDayArgs {
  date: string;
  flow?: FlowIntensity;
  symptoms?: string[];
  basalBodyTempC?: number;
  notes?: string;
}
interface DeleteDayArgs {
  date: string;
}
interface GetHistorySummaryArgs {
  lookbackDays?: number;
}
interface SaveProfileArgs {
  trackingGoals: TrackingGoal[];
  averageCycleLengthDays?: number;
  supplyList: SupplyItem[];
}
interface CreateReminderArgs {
  label: string;
  dueDate: string;
  relatedSupplyItem?: string;
}
interface DismissReminderArgs {
  reminderId: string;
}

/** Computes the live prediction + due auto-supply reminders from current history —
 *  shared by get_history_summary, list_reminders, and (indirectly) the context
 *  provider, so all three surfaces agree on what's due. */
async function computeLiveState(
  deps: WellnessToolDeps,
  userId: string,
  nowIso: string,
): Promise<{ cycles: ReturnType<typeof deriveCycles>; prediction: CyclePrediction | undefined; profile: WellnessProfile | undefined }> {
  const [entries, profile] = await Promise.all([
    deps.entries.entriesInRange(userId, '0001-01-01', nowIso.slice(0, 10)),
    deps.profiles.getProfile(userId),
  ]);
  const cycles = deriveCycles(entries);
  const prediction = predictNextCycle(cycles, nowIso, profile?.averageCycleLengthDays, lastFlowRunStart(entries));
  return { cycles, prediction, profile };
}

/** Materializes any newly-due auto-supply reminders as stored rows (idempotent per
 *  supply item + due date) and returns the full pending list, merging manual + auto. */
async function materializeAndListReminders(
  deps: WellnessToolDeps,
  userId: string,
  prediction: CyclePrediction | undefined,
  profile: WellnessProfile | undefined,
  nowIso: string,
): Promise<Reminder[]> {
  const due = dueSupplyReminders(profile?.supplyList ?? [], prediction, nowIso);
  for (const { item, dueDate } of due) {
    const existing = await deps.reminders.findAutoReminder(userId, item.name, dueDate);
    if (existing) continue;
    const reminder: Reminder = {
      id: deps.newId(),
      userId,
      kind: 'auto-supply',
      label: `Buy ${item.name}`,
      dueDate,
      status: 'pending',
      relatedSupplyItem: item.name,
      createdAt: nowIso,
    };
    await deps.reminders.createReminder(reminder);
    if (deps.publish) {
      const payload: ReminderDuePayload = { reminderId: reminder.id, label: reminder.label, dueDate };
      await deps.publish({
        eventId: deps.newId(),
        type: WELLNESS_REMINDER_DUE,
        userId,
        occurredAt: nowIso,
        payload,
      });
    }
  }
  return deps.reminders.listPending(userId);
}

export function createWellnessTools(deps: WellnessToolDeps): Tool[] {
  const { newId } = deps;
  const now = () => deps.now?.() ?? new Date().toISOString();

  const logDay: Tool<LogDayArgs, { date: string; saved: true }> = {
    name: 'wellness.log_day',
    description:
      "Log or correct a single day's cycle data (flow intensity, symptoms, basal body " +
      'temperature, notes). Idempotent per date — logging the same date again updates it.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'ISO date, yyyy-mm-dd' },
        flow: { type: 'string', enum: ['spotting', 'light', 'medium', 'heavy'] },
        symptoms: { type: 'array', items: { type: 'string' } },
        basalBodyTempC: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['date'],
    },
    outputSchema: {
      type: 'object',
      properties: { date: { type: 'string' }, saved: { type: 'boolean' } },
      required: ['date', 'saved'],
    },
    requiredCapability: 'wellness.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: LogDayArgs) => {
      const existing = (await deps.entries.entriesInRange(ctx.user.id, args.date, args.date))[0];
      const entry: CycleDayEntry = {
        id: existing?.id ?? newId(),
        userId: ctx.user.id,
        date: args.date,
        flow: args.flow,
        symptoms: args.symptoms,
        basalBodyTempC: args.basalBodyTempC,
        notes: args.notes,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      await deps.entries.upsertEntry(entry);
      return { date: args.date, saved: true };
    },
  };

  const deleteDay: Tool<DeleteDayArgs, { deleted: true }> = {
    name: 'wellness.delete_day',
    description: 'Remove a mistakenly logged day entry.',
    inputSchema: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'] },
    outputSchema: { type: 'object', properties: { deleted: { type: 'boolean' } }, required: ['deleted'] },
    requiredCapability: 'wellness.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: DeleteDayArgs) => {
      await deps.entries.deleteEntry(ctx.user.id, args.date);
      return { deleted: true };
    },
  };

  const getHistorySummary: Tool<GetHistorySummaryArgs, WellnessHistorySummary> = {
    name: 'wellness.get_history_summary',
    description:
      'Fetch structured recent cycle history, symptom frequency, the computed next-period ' +
      'prediction, and pending reminders — for reasoning about an insight or answer. Returns ' +
      'DATA ONLY — it does not itself narrate an insight; compose your reply using this data. ' +
      'If hasAnyHistory and hasProfile are both false, ask the user about their tracking goals ' +
      'and supply list first (call wellness.save_profile) instead of guessing.',
    inputSchema: {
      type: 'object',
      properties: { lookbackDays: { type: 'integer' } },
    },
    outputSchema: { type: 'object' },
    requiredCapability: 'wellness.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext): Promise<WellnessHistorySummary> => {
      const nowIso = now();
      const { cycles, prediction, profile } = await computeLiveState(deps, ctx.user.id, nowIso);
      const pendingReminders = await materializeAndListReminders(deps, ctx.user.id, prediction, profile, nowIso);

      const recentEntries = await deps.entries.recentEntries(ctx.user.id, 200);
      const tagCounts = new Map<string, number>();
      for (const entry of recentEntries) {
        for (const tag of entry.symptoms ?? []) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
      const recentSymptomTags = [...tagCounts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      const recentCycles: RecentCycleSummary[] = cycles.slice(-6);

      return {
        hasAnyHistory: cycles.length > 0 || recentEntries.length > 0,
        hasProfile: profile != null,
        recentCycles,
        recentSymptomTags,
        prediction,
        pendingReminders,
        profile,
      };
    },
  };

  const saveProfile: Tool<SaveProfileArgs, { saved: true }> = {
    name: 'wellness.save_profile',
    description:
      'Save or update the tracking profile (goals, self-reported average cycle length, ' +
      'and the supply list used for auto reminders). Ask the user for these before ' +
      'offering predictions or reminders if they have no history yet.',
    inputSchema: {
      type: 'object',
      properties: {
        trackingGoals: { type: 'array', items: { type: 'string' } },
        averageCycleLengthDays: { type: 'integer' },
        supplyList: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: { type: 'string' },
              defaultReminderDaysBefore: { type: 'integer' },
            },
            required: ['name', 'defaultReminderDaysBefore'],
          },
        },
      },
      required: ['trackingGoals', 'supplyList'],
    },
    outputSchema: { type: 'object', properties: { saved: { type: 'boolean' } }, required: ['saved'] },
    requiredCapability: 'wellness.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: SaveProfileArgs) => {
      const existing = await deps.profiles.getProfile(ctx.user.id);
      const profile: WellnessProfile = {
        userId: ctx.user.id,
        trackingGoals: args.trackingGoals,
        averageCycleLengthDays: args.averageCycleLengthDays,
        supplyList: args.supplyList,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      await deps.profiles.saveProfile(profile);
      return { saved: true };
    },
  };

  const getProfile: Tool<Record<string, never>, { profile: WellnessProfile | null }> = {
    name: 'wellness.get_profile',
    description: 'Read the saved tracking profile, if any.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { profile: {} }, required: ['profile'] },
    requiredCapability: 'wellness.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const profile = await deps.profiles.getProfile(ctx.user.id);
      return { profile: profile ?? null };
    },
  };

  const createReminder: Tool<CreateReminderArgs, { reminderId: string }> = {
    name: 'wellness.create_reminder',
    description: 'Create a manual, ad-hoc reminder (e.g. "remind me to buy ibuprofen on the 12th").',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        dueDate: { type: 'string', description: 'ISO date, yyyy-mm-dd' },
        relatedSupplyItem: { type: 'string' },
      },
      required: ['label', 'dueDate'],
    },
    outputSchema: { type: 'object', properties: { reminderId: { type: 'string' } }, required: ['reminderId'] },
    requiredCapability: 'wellness.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: CreateReminderArgs) => {
      const reminder: Reminder = {
        id: newId(),
        userId: ctx.user.id,
        kind: 'manual',
        label: args.label,
        dueDate: args.dueDate,
        status: 'pending',
        relatedSupplyItem: args.relatedSupplyItem,
        createdAt: now(),
      };
      await deps.reminders.createReminder(reminder);
      if (deps.publish) {
        const payload: ReminderDuePayload = { reminderId: reminder.id, label: reminder.label, dueDate: reminder.dueDate };
        await deps.publish({
          eventId: newId(),
          type: WELLNESS_REMINDER_DUE,
          userId: ctx.user.id,
          occurredAt: reminder.createdAt,
          payload,
        });
      }
      return { reminderId: reminder.id };
    },
  };

  const listReminders: Tool<Record<string, never>, { reminders: Reminder[] }> = {
    name: 'wellness.list_reminders',
    description:
      'List pending reminders — both manual ones and auto-supply reminders computed live ' +
      "from the next-period prediction and the user's supply list.",
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { reminders: { type: 'array' } }, required: ['reminders'] },
    requiredCapability: 'wellness.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const nowIso = now();
      const { prediction, profile } = await computeLiveState(deps, ctx.user.id, nowIso);
      const reminders = await materializeAndListReminders(deps, ctx.user.id, prediction, profile, nowIso);
      return { reminders };
    },
  };

  const dismissReminder: Tool<DismissReminderArgs, { dismissed: true }> = {
    name: 'wellness.dismiss_reminder',
    description: 'Mark a reminder as dismissed or done.',
    inputSchema: { type: 'object', properties: { reminderId: { type: 'string' } }, required: ['reminderId'] },
    outputSchema: { type: 'object', properties: { dismissed: { type: 'boolean' } }, required: ['dismissed'] },
    requiredCapability: 'wellness.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: DismissReminderArgs) => {
      await deps.reminders.markStatus(ctx.user.id, args.reminderId, 'dismissed');
      return { dismissed: true };
    },
  };

  return [logDay, deleteDay, getHistorySummary, saveProfile, getProfile, createReminder, listReminders, dismissReminder];
}
