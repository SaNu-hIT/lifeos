// Meal planning's Context Provider — a light existence/recency check only (cheap on
// every turn). The heavy per-day breakdown lives behind the meal.get_nutrition_summary
// and meal.get_week_plan tool calls, not here, so context assembly stays fast.

import type { ContextProvider, ContextRequest, UnifiedContext } from '@lifeos/contracts';
import type { PlannedMealRepositoryPort } from './ports/planned-meal.port.js';
import type { NutritionLogRepositoryPort } from './ports/nutrition-log.port.js';
import type { NutritionProfileRepositoryPort } from './ports/nutrition-profile.port.js';

export interface MealPlanningContextDeps {
  plannedMeals: PlannedMealRepositoryPort;
  nutritionLog: NutritionLogRepositoryPort;
  profiles: NutritionProfileRepositoryPort;
  now: () => string;
}

export function createMealPlanningContextProvider(deps: MealPlanningContextDeps): ContextProvider {
  return {
    scope: 'meal',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const nowIso = deps.now();
      const todayIso = nowIso.slice(0, 10);
      const [profile, hasAny, todayPlanned, todayLogged] = await Promise.all([
        deps.profiles.getProfile(request.userId),
        deps.nutritionLog.hasAny(request.userId),
        deps.plannedMeals.plannedMealsInRange(request.userId, todayIso, todayIso),
        deps.nutritionLog.entriesInRange(request.userId, todayIso, todayIso),
      ]);

      return {
        settings: {
          meal: {
            onboardingIncomplete: !profile && !hasAny,
            hasAnyHistory: hasAny,
            mealsPlannedToday: todayPlanned.length,
            foodsLoggedToday: todayLogged.length,
          },
        },
      };
    },
  };
}
