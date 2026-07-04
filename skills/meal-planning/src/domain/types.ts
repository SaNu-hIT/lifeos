// Meal planning & nutrition domain model. Pure first-party persistence — no external
// connector. Food names are freeform text (with a normalized companion key) grounded
// by an optional seeded catalog, mirroring Workout's exercise names. A grocery list
// is derived on demand from planned meals, never persisted as its own entity.

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Read-only, platform-seeded reference food with optional macros. Grounding only —
 *  a miss never blocks planning/logging (same contract as Workout's Exercise). */
export interface FoodItem {
  id: string;
  name: string;
  caloriesPerServing?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  defaultUnit?: string;
}

export interface PlannedMeal {
  id: string;
  userId: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  slot: MealSlot;
  foodName: string;
  foodId?: string;
  servings: number;
  notes?: string;
  createdAt: string;
}

export interface NutritionLogEntry {
  id: string;
  userId: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  slot?: MealSlot;
  foodName: string;
  foodId?: string;
  servings: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  loggedAt: string;
}

/** Aggregated grocery line — derived from planned meals, not stored. */
export interface GroceryListItem {
  name: string;
  foodId?: string;
  quantity: number;
  unit?: string;
}

export interface NutritionProfile {
  userId: string;
  dailyCalorieTarget?: number;
  proteinTargetG?: number;
  carbsTargetG?: number;
  fatTargetG?: number;
  dietaryRestrictions?: string[];
  createdAt: string;
  updatedAt: string;
}

// ── Shapes fed to the LLM for AI-composed insights ──────────────────────────────
// DATA only — the Skill never authors meal advice itself (same contract as
// Workout's WorkoutHistorySummary and Wellness's WellnessHistorySummary).

export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  entries: NutritionLogEntry[];
}

export interface MealPlanSummary {
  hasAnyHistory: boolean;
  hasProfile: boolean;
  weekStart: string;
  weekEnd: string;
  plannedMeals: PlannedMeal[];
  recentNutrition: DailyNutritionSummary[];
  profile?: NutritionProfile;
}
