// @lifeos/skill-meal-planning — Skill #7. Same SDK path as the other skills, another
// unrelated domain proving the platform generalises (ADR-0001). Its food catalog is
// platform-seeded reference data (like Workout's exercise catalog); everything else
// is pure first-party persistence, so there is no external ProviderPort.

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createMealPlanningTools, type MealPlanningToolDeps } from './tools.js';
import { createMealPlanningContextProvider } from './context.js';
import {
  createMealPlannedActivityProjection,
  createFoodLoggedActivityProjection,
  createMealPlannedNotification,
  createMealPlanningWidgets,
} from './surface.js';

export interface MealPlanningSkillDeps extends MealPlanningToolDeps {
  /** Injected clock for context/widgets — no hidden time (docs/02 §8). */
  now: () => string;
}

export function createMealPlanningSkill(deps: MealPlanningSkillDeps): SkillManifest {
  return defineSkill({
    // Skill key must be a single lowercase token (contract naming rule); the package
    // is @lifeos/skill-meal-planning but the runtime key + tool namespace is `meal`.
    key: 'meal',
    version: '1.0.0',
    title: 'Meal Planning',
    description:
      'Plan meals by day and slot, turn a week of plans into a consolidated grocery ' +
      'list, and log what you eat with AI-composed nutrition insights from your real ' +
      'food history.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'meal.read', description: 'View meal plans, grocery lists, and nutrition summaries' },
      { key: 'meal.track', description: 'Plan meals and log food/nutrition' },
    ],
    tools: createMealPlanningTools(deps),
    contextProviders: [
      createMealPlanningContextProvider({
        plannedMeals: deps.plannedMeals,
        nutritionLog: deps.nutritionLog,
        profiles: deps.profiles,
        now: deps.now,
      }),
    ],
    activityProjections: [createMealPlannedActivityProjection(), createFoodLoggedActivityProjection()],
    notifications: [createMealPlannedNotification()],
    widgets: createMealPlanningWidgets({
      plannedMeals: deps.plannedMeals,
      nutritionLog: deps.nutritionLog,
      profiles: deps.profiles,
      now: deps.now,
    }),
  });
}

export * from './domain/types.js';
export * from './domain/nutrition.js';
export * from './domain/grocery-aggregation.js';
export type { PlannedMealRepositoryPort } from './ports/planned-meal.port.js';
export type { NutritionLogRepositoryPort } from './ports/nutrition-log.port.js';
export type { NutritionProfileRepositoryPort } from './ports/nutrition-profile.port.js';
export type { FoodCatalogPort } from './ports/food-catalog.port.js';
export { createMealPlanningTools, type MealPlanningToolDeps } from './tools.js';
export { createMealPlanningContextProvider, type MealPlanningContextDeps } from './context.js';
export {
  MEAL_PLANNED,
  MEAL_FOOD_LOGGED,
  createMealPlannedActivityProjection,
  createFoodLoggedActivityProjection,
  createMealPlannedNotification,
  createMealPlanningWidgets,
  type MealPlannedPayload,
  type FoodLoggedPayload,
  type MealPlanningWidgetDeps,
} from './surface.js';
