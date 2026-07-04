// @lifeos/skill-workout — Skill #3. Same SDK path as Grocery/Calendar, a third
// unrelated domain proving the platform generalises (ADR-0001). Unlike Grocery
// (Blinkit) or Calendar (Google Calendar), Workout has no external connector — it is
// pure first-party persistence, so there is no ProviderPort or provider-contract.ts.

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createWorkoutTools, type WorkoutToolDeps } from './tools.js';
import { createWorkoutContextProvider } from './context.js';
import {
  createWorkoutActivityProjection,
  createWorkoutSessionActivityProjection,
  createWorkoutNotification,
  createWorkoutSessionNotification,
  createWorkoutWidgets,
} from './surface.js';

export interface WorkoutSkillDeps extends WorkoutToolDeps {
  /** Injected clock for context/widgets — no hidden time (docs/02 §8). */
  now: () => string;
}

export function createWorkoutSkill(deps: WorkoutSkillDeps): SkillManifest {
  return defineSkill({
    key: 'workout',
    version: '1.0.0',
    title: 'Workout',
    description:
      'Track workouts live, log sets/reps/weights with automatic PR detection, and get ' +
      'AI-composed workout suggestions based on your real training history.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'workout.read', description: 'View workout history, PRs, and training profile' },
      { key: 'workout.track', description: 'Log workouts, sets, and manage training profile' },
    ],
    tools: createWorkoutTools(deps),
    contextProviders: [
      createWorkoutContextProvider({ sessions: deps.sessions, profiles: deps.profiles, now: deps.now }),
    ],
    activityProjections: [createWorkoutActivityProjection(), createWorkoutSessionActivityProjection()],
    notifications: [createWorkoutNotification(), createWorkoutSessionNotification()],
    widgets: createWorkoutWidgets({ sessions: deps.sessions, now: deps.now }),
  });
}

export * from './domain/types.js';
export * from './domain/pr.js';
export * from './domain/recency.js';
export type { WorkoutSessionRepositoryPort } from './ports/workout-session.port.js';
export type { WorkoutSetRepositoryPort } from './ports/workout-set.port.js';
export type { WorkoutPrRepositoryPort } from './ports/workout-pr.port.js';
export type { WorkoutProfileRepositoryPort } from './ports/workout-profile.port.js';
export type { ExerciseCatalogPort } from './ports/exercise-catalog.port.js';
export { createWorkoutTools, type WorkoutToolDeps } from './tools.js';
export { createWorkoutContextProvider, type WorkoutContextDeps } from './context.js';
export {
  WORKOUT_PR_ACHIEVED,
  WORKOUT_SESSION_FINISHED,
  createWorkoutActivityProjection,
  createWorkoutSessionActivityProjection,
  createWorkoutNotification,
  createWorkoutSessionNotification,
  createWorkoutWidgets,
  type PrAchievedPayload,
  type SessionFinishedPayload,
  type WorkoutWidgetDeps,
} from './surface.js';
