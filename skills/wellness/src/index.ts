// @lifeos/skill-wellness — Skill #4. Women's health: period/cycle tracking, symptom
// logging, a computed next-period prediction, and reminders to restock supplies.
// Like Workout, Wellness is pure first-party persistence — no external connector, no
// ProviderPort/provider-contract.ts.

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createWellnessTools, type WellnessToolDeps } from './tools.js';
import { createWellnessContextProvider } from './context.js';
import {
  createWellnessReminderActivityProjection,
  createWellnessCycleActivityProjection,
  createWellnessReminderNotification,
  createWellnessWidgets,
} from './surface.js';

export interface WellnessSkillDeps extends WellnessToolDeps {
  /** Injected clock for context/widgets — no hidden time (docs/02 §8). */
  now: () => string;
}

export function createWellnessSkill(deps: WellnessSkillDeps): SkillManifest {
  return defineSkill({
    key: 'wellness',
    version: '1.0.0',
    title: 'Wellness',
    description:
      'Track your cycle and symptoms, get a computed next-period prediction plus an ' +
      'AI-composed insight, and get reminders to restock supplies.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'wellness.read', description: 'View cycle history, predictions, profile, and reminders' },
      { key: 'wellness.track', description: 'Log cycle days, manage profile, and manage reminders' },
    ],
    tools: createWellnessTools(deps),
    contextProviders: [
      createWellnessContextProvider({
        entries: deps.entries,
        profiles: deps.profiles,
        reminders: deps.reminders,
        now: deps.now,
      }),
    ],
    activityProjections: [createWellnessReminderActivityProjection(), createWellnessCycleActivityProjection()],
    notifications: [createWellnessReminderNotification()],
    widgets: createWellnessWidgets({
      entries: deps.entries,
      profiles: deps.profiles,
      reminders: deps.reminders,
      now: deps.now,
    }),
  });
}

export * from './domain/types.js';
export * from './domain/cycle.js';
export * from './domain/reminders.js';
export type { CycleEntryRepositoryPort } from './ports/cycle-entry.port.js';
export type { WellnessProfileRepositoryPort } from './ports/wellness-profile.port.js';
export type { ReminderRepositoryPort } from './ports/reminder.port.js';
export { createWellnessTools, type WellnessToolDeps } from './tools.js';
export { createWellnessContextProvider, type WellnessContextDeps } from './context.js';
export {
  WELLNESS_REMINDER_DUE,
  WELLNESS_CYCLE_LOGGED,
  createWellnessReminderActivityProjection,
  createWellnessCycleActivityProjection,
  createWellnessReminderNotification,
  createWellnessWidgets,
  type ReminderDuePayload,
  type CycleLoggedPayload,
  type WellnessWidgetDeps,
} from './surface.js';
