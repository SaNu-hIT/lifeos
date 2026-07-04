import type { PlannedMeal } from '../domain/types.js';

export interface PlannedMealRepositoryPort {
  addPlannedMeal(meal: PlannedMeal): Promise<void>;
  removePlannedMeal(userId: string, plannedMealId: string): Promise<void>;
  /** Planned meals with date in [fromDate, toDate], ordered by date then slot. */
  plannedMealsInRange(userId: string, fromDate: string, toDate: string): Promise<PlannedMeal[]>;
}
