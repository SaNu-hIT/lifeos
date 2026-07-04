// @lifeos/skill-habit — Skill #6. Same SDK path as the other skills, another
// unrelated domain proving the platform generalises (ADR-0001). Like Workout/
// Wellness/Finance it has no external connector — pure first-party persistence.

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createHabitTools, type HabitToolDeps } from './tools.js';
import { createHabitContextProvider } from './context.js';
import {
  createHabitCheckedInActivityProjection,
  createHabitMilestoneActivityProjection,
  createHabitMilestoneNotification,
  createHabitWidgets,
} from './surface.js';

export interface HabitSkillDeps extends HabitToolDeps {
  /** Injected clock for context/widgets — no hidden time (docs/02 §8). */
  now: () => string;
}

export function createHabitSkill(deps: HabitSkillDeps): SkillManifest {
  return defineSkill({
    key: 'habit',
    version: '1.0.0',
    title: 'Habits',
    description:
      'Build routines: define habits, check in daily, keep streaks, and get ' +
      'AI-composed nudges based on your real check-in history.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'habit.read', description: 'View habits, streaks, and progress summaries' },
      { key: 'habit.track', description: 'Create habits and log daily check-ins' },
    ],
    tools: createHabitTools(deps),
    contextProviders: [
      createHabitContextProvider({ habits: deps.habits, checkIns: deps.checkIns, now: deps.now }),
    ],
    activityProjections: [
      createHabitCheckedInActivityProjection(),
      createHabitMilestoneActivityProjection(),
    ],
    notifications: [createHabitMilestoneNotification()],
    widgets: createHabitWidgets({ habits: deps.habits, checkIns: deps.checkIns, now: deps.now }),
  });
}

export * from './domain/types.js';
export * from './domain/streak.js';
export type { HabitRepositoryPort } from './ports/habit.port.js';
export type { HabitCheckInRepositoryPort } from './ports/habit-checkin.port.js';
export { createHabitTools, type HabitToolDeps } from './tools.js';
export { createHabitContextProvider, type HabitContextDeps } from './context.js';
export {
  HABIT_CHECKED_IN,
  HABIT_STREAK_MILESTONE,
  createHabitCheckedInActivityProjection,
  createHabitMilestoneActivityProjection,
  createHabitMilestoneNotification,
  createHabitWidgets,
  type HabitCheckedInPayload,
  type StreakMilestonePayload,
  type HabitWidgetDeps,
} from './surface.js';
