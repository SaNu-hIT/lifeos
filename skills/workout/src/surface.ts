// Workout's surface contributions — feed, notifications, and a "Last workout" home
// widget. Declarative; installed by the SkillHost. No platform imports (ADR-0001).

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import type { WorkoutSessionRepositoryPort } from './ports/workout-session.port.js';

export const WORKOUT_PR_ACHIEVED = 'workout.pr_achieved';
export const WORKOUT_SESSION_FINISHED = 'workout.session_finished';

export interface PrAchievedPayload {
  setId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  prKind: 'weight' | 'volume' | 'both';
}

export interface SessionFinishedPayload {
  sessionId: string;
  title?: string;
  totalSets: number;
  prCount: number;
  durationMinutes: number;
}

export function createWorkoutActivityProjection(): ActivityProjection {
  return {
    key: 'workout.pr_achieved',
    on: WORKOUT_PR_ACHIEVED,
    build: (event: DomainEvent) => {
      const p = event.payload as PrAchievedPayload;
      return {
        userId: event.userId!,
        kind: WORKOUT_PR_ACHIEVED,
        title: 'New PR!',
        summary: `${p.exerciseName} — ${p.weightKg}kg × ${p.reps}`,
        deepLink: `/workout/sets/${p.setId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createWorkoutSessionActivityProjection(): ActivityProjection {
  return {
    key: 'workout.session_finished',
    on: WORKOUT_SESSION_FINISHED,
    build: (event: DomainEvent) => {
      const p = event.payload as SessionFinishedPayload;
      return {
        userId: event.userId!,
        kind: WORKOUT_SESSION_FINISHED,
        title: 'Finished a workout',
        summary: `${p.title ?? 'Workout'} — ${p.totalSets} sets, ${p.prCount} PR${p.prCount === 1 ? '' : 's'}`,
        deepLink: `/workout/sessions/${p.sessionId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createWorkoutNotification(): NotificationDeclaration {
  return {
    key: 'workout.pr_achieved',
    on: WORKOUT_PR_ACHIEVED,
    build: (event: DomainEvent) => {
      const p = event.payload as PrAchievedPayload;
      return {
        userId: event.userId!,
        kind: WORKOUT_PR_ACHIEVED,
        title: 'New personal record!',
        body: `${p.exerciseName} — ${p.weightKg}kg × ${p.reps}`,
        importance: 'normal',
        channels: ['in_app'],
        deepLink: `/workout/sets/${p.setId}`,
        dedupeKey: `workout.pr.${p.setId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createWorkoutSessionNotification(): NotificationDeclaration {
  return {
    key: 'workout.session_finished',
    on: WORKOUT_SESSION_FINISHED,
    build: (event: DomainEvent) => {
      const p = event.payload as SessionFinishedPayload;
      return {
        userId: event.userId!,
        kind: WORKOUT_SESSION_FINISHED,
        title: 'Nice work!',
        body: `${p.title ?? 'Workout'} finished — ${p.totalSets} sets, ${p.prCount} PR${p.prCount === 1 ? '' : 's'}`,
        importance: 'low',
        channels: ['in_app'],
        deepLink: `/workout/sessions/${p.sessionId}`,
        dedupeKey: `workout.session.${p.sessionId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface WorkoutWidgetDeps {
  sessions: WorkoutSessionRepositoryPort;
  /** Injected "now" — no hidden clocks (docs/02 §8). */
  now: () => string;
}

/** Home widget: "Last workout". Hides entirely for brand-new users with zero
 *  history so it doesn't clutter the home surface pre-onboarding. */
export function createWorkoutWidgets(deps: WorkoutWidgetDeps): WidgetContribution[] {
  return [
    {
      key: 'workout.last_workout',
      title: 'Last workout',
      requiredCapability: 'workout.read',
      priority: 25,
      build: async (ctx) => {
        const active = await deps.sessions.getActiveSession(ctx.userId);
        const recent = await deps.sessions.recentSessions(ctx.userId, 1);
        const last = recent[0];
        if (!active && !last) return null;
        return {
          urgency: active ? 0.6 : 0.2,
          asOf: active?.startedAt ?? last?.finishedAt ?? last?.startedAt,
          props: {
            activeSessionId: active?.id ?? null,
            lastSession: last
              ? { id: last.id, title: last.title, finishedAt: last.finishedAt }
              : null,
          },
        };
      },
    },
  ];
}
