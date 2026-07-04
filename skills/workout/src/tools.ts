// Workout tools — the units the Planner can call. Handlers close over injected
// ports only (ADR-0004: logic lives here, the AI never touches the DB directly).
// `get_history_summary` is deliberately data-only: it hands the LLM clean structured
// history so IT composes a suggestion in chat — no rule-based recommender lives here.

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type {
  Equipment,
  Exercise,
  ExerciseRecentActivity,
  MuscleGroup,
  MuscleGroupRecency,
  PersonalRecord,
  PrKind,
  RecentSessionSummary,
  SetEntry,
  TrainingGoal,
  ExperienceLevel,
  WorkoutHistorySummary,
  WorkoutProfile,
  WorkoutSession,
} from './domain/types.js';
import { evaluatePr, normalizeExerciseName } from './domain/pr.js';
import { daysSince } from './domain/recency.js';
import type { WorkoutSessionRepositoryPort } from './ports/workout-session.port.js';
import type { WorkoutSetRepositoryPort } from './ports/workout-set.port.js';
import type { WorkoutPrRepositoryPort } from './ports/workout-pr.port.js';
import type { WorkoutProfileRepositoryPort } from './ports/workout-profile.port.js';
import type { ExerciseCatalogPort } from './ports/exercise-catalog.port.js';
import {
  WORKOUT_PR_ACHIEVED,
  WORKOUT_SESSION_FINISHED,
  type PrAchievedPayload,
  type SessionFinishedPayload,
} from './surface.js';

export interface WorkoutToolDeps {
  sessions: WorkoutSessionRepositoryPort;
  sets: WorkoutSetRepositoryPort;
  prs: WorkoutPrRepositoryPort;
  profiles: WorkoutProfileRepositoryPort;
  catalog: ExerciseCatalogPort;
  newId: () => string;
  /** Injected clock — no hidden "now" (docs/02 §8). Defaults to real time. */
  now?: () => string;
  publish?: (event: DomainEvent) => Promise<void>;
}

const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'full_body',
];

interface StartSessionArgs {
  title?: string;
}
interface LogSetArgs {
  /** Optional — defaults to the caller's current active session (there is at most
   *  one), so the planner doesn't need to remember an id from a prior turn. */
  sessionId?: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  rpe?: number;
  notes?: string;
}
interface EditSetArgs {
  setId: string;
  weightKg?: number;
  reps?: number;
  rpe?: number;
  notes?: string;
}
interface DeleteSetArgs {
  setId: string;
}
interface FinishSessionArgs {
  /** Optional — defaults to the caller's current active session. */
  sessionId?: string;
  title?: string;
  notes?: string;
}
interface CancelSessionArgs {
  /** Optional — defaults to the caller's current active session. */
  sessionId?: string;
}
interface GetHistorySummaryArgs {
  lookbackSessions?: number;
  lookbackDays?: number;
}
interface GetExerciseHistoryArgs {
  exerciseName: string;
  limit?: number;
}
interface SaveProfileArgs {
  frequencyPerWeek: number;
  goals: TrainingGoal[];
  experience: ExperienceLevel;
  availableEquipment: Equipment[];
  preferredDurationMinutes?: number;
}
interface ListExercisesArgs {
  query?: string;
  muscle?: MuscleGroup;
  equipment?: Equipment;
}

export function createWorkoutTools(deps: WorkoutToolDeps): Tool[] {
  const { newId } = deps;
  const now = () => deps.now?.() ?? new Date().toISOString();

  /** Resolves an explicit sessionId, or falls back to the caller's one active
   *  session — the planner rarely retains an id across turns, and since only one
   *  session can be active at a time (docs: 0022 migration), "the active one" is
   *  unambiguous. Throws if there's no active session to fall back to. */
  async function resolveActiveSession(userId: string, sessionId: string | undefined): Promise<WorkoutSession> {
    const session = sessionId
      ? await deps.sessions.getSession(userId, sessionId)
      : await deps.sessions.getActiveSession(userId);
    if (!session || session.status !== 'active') {
      throw new Error('no active session — call workout.start_session first');
    }
    return session;
  }

  const startSession: Tool<StartSessionArgs, { sessionId: string; alreadyActive: boolean }> = {
    name: 'workout.start_session',
    description:
      "Start a new live workout session so sets can be logged as they happen. If the user " +
      'already has an active session, returns its id instead of erroring.',
    inputSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
    },
    outputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' }, alreadyActive: { type: 'boolean' } },
      required: ['sessionId', 'alreadyActive'],
    },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: StartSessionArgs) => {
      const existing = await deps.sessions.getActiveSession(ctx.user.id);
      if (existing) return { sessionId: existing.id, alreadyActive: true };

      const session: WorkoutSession = {
        id: newId(),
        userId: ctx.user.id,
        status: 'active',
        title: args.title,
        startedAt: now(),
      };
      await deps.sessions.createSession(session);
      return { sessionId: session.id, alreadyActive: false };
    },
  };

  const logSet: Tool<
    LogSetArgs,
    { setId: string; setNumber: number; isPr: boolean; prKind?: PrKind; matchedCatalogExercise?: string }
  > = {
    name: 'workout.log_set',
    description:
      'Log one completed set (exercise, weight in kg, reps) for the active session. ' +
      'sessionId is optional — omit it to use the current active session. ' +
      'Automatically detects and records personal records (PRs). Exercise names are ' +
      'freeform — any text works, the catalog is only used for grounding.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        exerciseName: { type: 'string' },
        weightKg: { type: 'number' },
        reps: { type: 'integer' },
        rpe: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['exerciseName', 'weightKg', 'reps'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        setId: { type: 'string' },
        setNumber: { type: 'integer' },
        isPr: { type: 'boolean' },
        prKind: { type: 'string' },
        matchedCatalogExercise: { type: 'string' },
      },
      required: ['setId', 'setNumber', 'isPr'],
    },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: LogSetArgs) => {
      const session = await resolveActiveSession(ctx.user.id, args.sessionId);

      const normalized = normalizeExerciseName(args.exerciseName);
      const matched = await deps.catalog.findByName(normalized);
      const priorSets = await deps.sets.setsForSession(ctx.user.id, session.id);
      const setNumber =
        priorSets.filter((s) => normalizeExerciseName(s.exerciseName) === normalized).length + 1;

      const priorPr = await deps.prs.getPr(ctx.user.id, normalized);
      const evaluation = evaluatePr(priorPr, { weightKg: args.weightKg, reps: args.reps });

      const set: SetEntry = {
        id: newId(),
        sessionId: session.id,
        userId: ctx.user.id,
        exerciseName: args.exerciseName,
        exerciseId: matched?.id,
        setNumber,
        weightKg: args.weightKg,
        reps: args.reps,
        rpe: args.rpe,
        notes: args.notes,
        isPr: evaluation.isPr,
        prKind: evaluation.kind,
        createdAt: now(),
      };
      await deps.sets.addSet(set);

      if (evaluation.isPr) {
        const record: PersonalRecord = {
          id: priorPr?.id ?? newId(),
          userId: ctx.user.id,
          exerciseName: normalized,
          ...evaluation.updated,
          achievedAt: set.createdAt,
          sourceSetId: set.id,
        };
        await deps.prs.upsertPr(record);

        if (deps.publish) {
          const payload: PrAchievedPayload = {
            setId: set.id,
            exerciseName: args.exerciseName,
            weightKg: args.weightKg,
            reps: args.reps,
            prKind: evaluation.kind!,
          };
          await deps.publish({
            eventId: newId(),
            type: WORKOUT_PR_ACHIEVED,
            userId: ctx.user.id,
            occurredAt: set.createdAt,
            payload,
          });
        }
      }

      return {
        setId: set.id,
        setNumber: set.setNumber,
        isPr: set.isPr,
        prKind: set.prKind,
        matchedCatalogExercise: matched?.name,
      };
    },
  };

  const editSet: Tool<EditSetArgs, { setId: string; recomputedPr: boolean }> = {
    name: 'workout.edit_set',
    description:
      "Correct a previously logged set's weight, reps, RPE, or notes. Recomputes PR " +
      'status for this set only (does not retroactively rescan the rest of the ' +
      "session or history — v1 limitation, documented)."
    ,
    inputSchema: {
      type: 'object',
      properties: {
        setId: { type: 'string' },
        weightKg: { type: 'number' },
        reps: { type: 'integer' },
        rpe: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['setId'],
    },
    outputSchema: {
      type: 'object',
      properties: { setId: { type: 'string' }, recomputedPr: { type: 'boolean' } },
      required: ['setId', 'recomputedPr'],
    },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: EditSetArgs) => {
      const updated = await deps.sets.updateSet(ctx.user.id, args.setId, {
        weightKg: args.weightKg,
        reps: args.reps,
        rpe: args.rpe,
        notes: args.notes,
      });
      if (!updated) throw new Error('set not found');

      const normalized = normalizeExerciseName(updated.exerciseName);
      const priorPr = await deps.prs.getPr(ctx.user.id, normalized);
      const evaluation = evaluatePr(
        priorPr?.sourceSetId === updated.id ? undefined : priorPr,
        { weightKg: updated.weightKg, reps: updated.reps },
      );
      if (evaluation.isPr) {
        await deps.prs.upsertPr({
          id: priorPr?.id ?? newId(),
          userId: ctx.user.id,
          exerciseName: normalized,
          ...evaluation.updated,
          achievedAt: now(),
          sourceSetId: updated.id,
        });
      }
      return { setId: updated.id, recomputedPr: evaluation.isPr };
    },
  };

  const deleteSet: Tool<DeleteSetArgs, { deleted: true }> = {
    name: 'workout.delete_set',
    description: 'Remove a mistakenly logged set.',
    inputSchema: { type: 'object', properties: { setId: { type: 'string' } }, required: ['setId'] },
    outputSchema: { type: 'object', properties: { deleted: { type: 'boolean' } }, required: ['deleted'] },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: DeleteSetArgs) => {
      await deps.sets.deleteSet(ctx.user.id, args.setId);
      return { deleted: true };
    },
  };

  const finishSession: Tool<
    FinishSessionArgs,
    { sessionId: string; durationMinutes: number; totalSets: number; prCount: number }
  > = {
    name: 'workout.finish_session',
    description:
      'End the active workout session, optionally naming/annotating it. sessionId is ' +
      'optional — omit it to use the current active session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        title: { type: 'string' },
        notes: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        durationMinutes: { type: 'integer' },
        totalSets: { type: 'integer' },
        prCount: { type: 'integer' },
      },
      required: ['sessionId', 'durationMinutes', 'totalSets', 'prCount'],
    },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: FinishSessionArgs) => {
      const session = await resolveActiveSession(ctx.user.id, args.sessionId);

      const finishedAt = now();
      await deps.sessions.finishSession(ctx.user.id, session.id, {
        finishedAt,
        title: args.title ?? session.title,
        notes: args.notes,
        status: 'finished',
      });

      const setsInSession = await deps.sets.setsForSession(ctx.user.id, session.id);
      const totalSets = setsInSession.length;
      const prCount = setsInSession.filter((s) => s.isPr).length;
      const durationMinutes = Math.max(
        0,
        Math.round((new Date(finishedAt).getTime() - new Date(session.startedAt).getTime()) / 60000),
      );

      if (deps.publish) {
        const payload: SessionFinishedPayload = {
          sessionId: session.id,
          title: args.title ?? session.title,
          totalSets,
          prCount,
          durationMinutes,
        };
        await deps.publish({
          eventId: newId(),
          type: WORKOUT_SESSION_FINISHED,
          userId: ctx.user.id,
          occurredAt: finishedAt,
          payload,
        });
      }

      return { sessionId: session.id, durationMinutes, totalSets, prCount };
    },
  };

  const cancelSession: Tool<CancelSessionArgs, { cancelled: true }> = {
    name: 'workout.cancel_session',
    description:
      'Abandon the active session without recording it as a completed workout. ' +
      'sessionId is optional — omit it to use the current active session.',
    inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { cancelled: { type: 'boolean' } }, required: ['cancelled'] },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: CancelSessionArgs) => {
      const session = await resolveActiveSession(ctx.user.id, args.sessionId);
      await deps.sessions.finishSession(ctx.user.id, session.id, {
        finishedAt: now(),
        status: 'cancelled',
      });
      return { cancelled: true };
    },
  };

  const getHistorySummary: Tool<GetHistorySummaryArgs, WorkoutHistorySummary> = {
    name: 'workout.get_history_summary',
    description:
      'Fetch structured recent workout history (recent sessions, per-exercise recent ' +
      'sets/PRs, days since each muscle group was last trained) for reasoning about a ' +
      'workout suggestion. Returns DATA ONLY — it does not itself suggest a workout; ' +
      "compose the suggestion in your reply using this data. If hasAnyHistory and " +
      'hasProfile are both false, ask the user about their training schedule, goals, ' +
      'experience, and available equipment first (call workout.save_profile) instead ' +
      'of suggesting anything blind.',
    inputSchema: {
      type: 'object',
      properties: {
        lookbackSessions: { type: 'integer' },
        lookbackDays: { type: 'integer' },
      },
    },
    outputSchema: { type: 'object' },
    requiredCapability: 'workout.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: GetHistorySummaryArgs) => {
      const lookbackSessions = args.lookbackSessions ?? 10;
      const nowIso = now();

      const [profile, activeSession, recentSessionRows] = await Promise.all([
        deps.profiles.getProfile(ctx.user.id),
        deps.sessions.getActiveSession(ctx.user.id),
        deps.sessions.recentSessions(ctx.user.id, lookbackSessions),
      ]);

      const recentSessions: RecentSessionSummary[] = [];
      const perExerciseMap = new Map<string, ExerciseRecentActivity>();

      for (const session of recentSessionRows) {
        const setsInSession = await deps.sets.setsForSession(ctx.user.id, session.id);
        const byExercise = new Map<string, SetEntry[]>();
        for (const s of setsInSession) {
          const key = s.exerciseName;
          byExercise.set(key, [...(byExercise.get(key) ?? []), s]);
        }
        recentSessions.push({
          sessionId: session.id,
          startedAt: session.startedAt,
          finishedAt: session.finishedAt,
          title: session.title,
          exercises: [...byExercise.entries()].map(([exerciseName, exerciseSets]) => {
            const topSet = exerciseSets.reduce((best, s) =>
              s.weightKg * s.reps > best.weightKg * best.reps ? s : best,
            );
            return { exerciseName, setCount: exerciseSets.length, topSet: { weightKg: topSet.weightKg, reps: topSet.reps } };
          }),
        });

        for (const [exerciseName, exerciseSets] of byExercise) {
          const normalized = normalizeExerciseName(exerciseName);
          if (!perExerciseMap.has(normalized)) {
            const pr = await deps.prs.getPr(ctx.user.id, normalized);
            perExerciseMap.set(normalized, {
              exerciseName,
              lastPerformedAt: session.startedAt,
              recentSets: exerciseSets.map((s) => ({
                weightKg: s.weightKg,
                reps: s.reps,
                rpe: s.rpe,
                performedAt: s.createdAt,
              })),
              personalRecord: pr,
            });
          }
        }
      }

      const lastPerformedByMuscle = await deps.sets.lastPerformedByMuscle(ctx.user.id, ALL_MUSCLE_GROUPS);
      const muscleGroupRecency: MuscleGroupRecency[] = ALL_MUSCLE_GROUPS.map((muscle) => {
        const last = lastPerformedByMuscle[muscle];
        return { muscle, daysSinceLastTrained: last ? daysSince(last, nowIso) : null };
      });

      return {
        hasAnyHistory: recentSessionRows.length > 0,
        hasProfile: profile != null,
        recentSessions,
        perExercise: [...perExerciseMap.values()],
        muscleGroupRecency,
        activeSessionId: activeSession?.id,
        profile,
      };
    },
  };

  const getExerciseHistory: Tool<
    GetExerciseHistoryArgs,
    { exerciseName: string; recentSets: { weightKg: number; reps: number; rpe?: number; performedAt: string }[]; personalRecord?: PersonalRecord }
  > = {
    name: 'workout.get_exercise_history',
    description: 'Recent sets and the PR for one specific exercise (e.g. "how is my bench doing").',
    inputSchema: {
      type: 'object',
      properties: { exerciseName: { type: 'string' }, limit: { type: 'integer' } },
      required: ['exerciseName'],
    },
    outputSchema: { type: 'object' },
    requiredCapability: 'workout.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: GetExerciseHistoryArgs) => {
      const normalized = normalizeExerciseName(args.exerciseName);
      const [recentSets, pr] = await Promise.all([
        deps.sets.recentSetsForExercise(ctx.user.id, normalized, args.limit ?? 10),
        deps.prs.getPr(ctx.user.id, normalized),
      ]);
      return {
        exerciseName: args.exerciseName,
        recentSets: recentSets.map((s) => ({
          weightKg: s.weightKg,
          reps: s.reps,
          rpe: s.rpe,
          performedAt: s.createdAt,
        })),
        personalRecord: pr,
      };
    },
  };

  const saveProfile: Tool<SaveProfileArgs, { saved: true }> = {
    name: 'workout.save_profile',
    description:
      'Save or update the training profile (frequency per week, goals, experience ' +
      'level, available equipment). Ask the user for these before suggesting a ' +
      'workout if they have no history yet.',
    inputSchema: {
      type: 'object',
      properties: {
        frequencyPerWeek: { type: 'integer' },
        goals: { type: 'array', items: { type: 'string' } },
        experience: { type: 'string' },
        availableEquipment: { type: 'array', items: { type: 'string' } },
        preferredDurationMinutes: { type: 'integer' },
      },
      required: ['frequencyPerWeek', 'goals', 'experience', 'availableEquipment'],
    },
    outputSchema: { type: 'object', properties: { saved: { type: 'boolean' } }, required: ['saved'] },
    requiredCapability: 'workout.track',
    idempotent: false,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: SaveProfileArgs) => {
      const existing = await deps.profiles.getProfile(ctx.user.id);
      const profile: WorkoutProfile = {
        userId: ctx.user.id,
        frequencyPerWeek: args.frequencyPerWeek,
        goals: args.goals,
        experience: args.experience,
        availableEquipment: args.availableEquipment,
        preferredDurationMinutes: args.preferredDurationMinutes,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      await deps.profiles.saveProfile(profile);
      return { saved: true };
    },
  };

  const getProfile: Tool<Record<string, never>, { profile: WorkoutProfile | null }> = {
    name: 'workout.get_profile',
    description: 'Read the saved training profile, if any.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { profile: {} }, required: ['profile'] },
    requiredCapability: 'workout.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const profile = await deps.profiles.getProfile(ctx.user.id);
      return { profile: profile ?? null };
    },
  };

  const listExercises: Tool<ListExercisesArgs, { exercises: Exercise[]; note: string }> = {
    name: 'workout.list_exercises',
    description:
      'Search or browse the seeded exercise catalog, for grounding/autocomplete. This ' +
      'is not exhaustive — any exercise name may be logged via workout.log_set even if ' +
      "it isn't in this list.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        muscle: { type: 'string' },
        equipment: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: { exercises: { type: 'array' }, note: { type: 'string' } },
      required: ['exercises', 'note'],
    },
    requiredCapability: 'workout.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (_ctx: UnifiedContext, args: ListExercisesArgs) => {
      const exercises = args.query
        ? await deps.catalog.search(args.query)
        : await deps.catalog.list({ muscle: args.muscle, equipment: args.equipment });
      return {
        exercises,
        note: 'You are not limited to this list — you may log any exercise name.',
      };
    },
  };

  return [
    startSession,
    logSet,
    editSet,
    deleteSet,
    finishSession,
    cancelSession,
    getHistorySummary,
    getExerciseHistory,
    saveProfile,
    getProfile,
    listExercises,
  ];
}
