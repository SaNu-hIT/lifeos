// Meal planning's surface contributions — feed, notification, and a "Nutrition" home
// widget. Declarative; installed by the SkillHost. No platform imports (ADR-0001).

import type {
  ActivityProjection,
  DomainEvent,
  NotificationDeclaration,
  WidgetContribution,
} from '@lifeos/contracts';
import type { MealSlot } from './domain/types.js';
import { summarizeDay } from './domain/nutrition.js';
import type { PlannedMealRepositoryPort } from './ports/planned-meal.port.js';
import type { NutritionLogRepositoryPort } from './ports/nutrition-log.port.js';
import type { NutritionProfileRepositoryPort } from './ports/nutrition-profile.port.js';

export const MEAL_PLANNED = 'meal.planned';
export const MEAL_FOOD_LOGGED = 'meal.food_logged';

export interface MealPlannedPayload {
  plannedMealId: string;
  date: string;
  slot: MealSlot;
  foodName: string;
}

export interface FoodLoggedPayload {
  entryId: string;
  foodName: string;
  date: string;
  calories?: number;
}

export function createMealPlannedActivityProjection(): ActivityProjection {
  return {
    key: 'meal.planned',
    on: MEAL_PLANNED,
    build: (event: DomainEvent) => {
      const p = event.payload as MealPlannedPayload;
      return {
        userId: event.userId!,
        kind: MEAL_PLANNED,
        title: 'Meal planned',
        summary: `${p.foodName} — ${p.slot} on ${p.date}`,
        deepLink: `/meals?date=${p.date}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createFoodLoggedActivityProjection(): ActivityProjection {
  return {
    key: 'meal.food_logged',
    on: MEAL_FOOD_LOGGED,
    build: (event: DomainEvent) => {
      const p = event.payload as FoodLoggedPayload;
      return {
        userId: event.userId!,
        kind: MEAL_FOOD_LOGGED,
        title: 'Food logged',
        summary: p.calories != null ? `${p.foodName} — ${Math.round(p.calories)} kcal` : p.foodName,
        deepLink: `/meals/nutrition?date=${p.date}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export function createMealPlannedNotification(): NotificationDeclaration {
  return {
    key: 'meal.planned',
    on: MEAL_PLANNED,
    build: (event: DomainEvent) => {
      const p = event.payload as MealPlannedPayload;
      return {
        userId: event.userId!,
        kind: MEAL_PLANNED,
        title: 'Meal planned',
        body: `${p.foodName} added to ${p.slot} on ${p.date}.`,
        importance: 'low',
        channels: ['in_app'],
        deepLink: `/meals?date=${p.date}`,
        dedupeKey: `meal.planned.${p.plannedMealId}`,
        occurredAt: event.occurredAt,
      };
    },
  };
}

export interface MealPlanningWidgetDeps {
  plannedMeals: PlannedMealRepositoryPort;
  nutritionLog: NutritionLogRepositoryPort;
  profiles: NutritionProfileRepositoryPort;
  /** Injected "now" — no hidden clocks (docs/02 §8). */
  now: () => string;
}

/** Home widget: "Nutrition" — today's calories vs. target and meals planned today.
 *  Hides entirely for brand-new users with nothing planned/logged (same as Workout). */
export function createMealPlanningWidgets(deps: MealPlanningWidgetDeps): WidgetContribution[] {
  return [
    {
      key: 'meal.nutrition',
      title: 'Nutrition',
      requiredCapability: 'meal.read',
      priority: 26,
      build: async (ctx) => {
        const todayIso = deps.now().slice(0, 10);
        const [todayLogged, todayPlanned, profile] = await Promise.all([
          deps.nutritionLog.entriesInRange(ctx.userId, todayIso, todayIso),
          deps.plannedMeals.plannedMealsInRange(ctx.userId, todayIso, todayIso),
          deps.profiles.getProfile(ctx.userId),
        ]);
        if (todayLogged.length === 0 && todayPlanned.length === 0) return null;

        const today = summarizeDay(todayIso, todayLogged);
        const target = profile?.dailyCalorieTarget;
        const overTarget = target != null && today.totalCalories > target;

        return {
          urgency: overTarget ? 0.5 : 0.2,
          asOf: deps.now(),
          props: {
            caloriesToday: Math.round(today.totalCalories),
            calorieTarget: target ?? null,
            mealsPlannedToday: todayPlanned.length,
          },
        };
      },
    },
  ];
}
