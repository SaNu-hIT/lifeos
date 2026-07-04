// Pure grocery-list aggregation — group planned meals by normalized food name and
// sum servings. v1 returns this data for the user/LLM to act on; it deliberately
// does NOT write into the Grocery skill (ADR-0001: no cross-skill imports).

import { normalizeFoodName } from './nutrition.js';
import type { GroceryListItem, PlannedMeal } from './types.js';

export function aggregateGroceryList(plannedMeals: PlannedMeal[]): GroceryListItem[] {
  const byFood = new Map<string, GroceryListItem>();
  for (const meal of plannedMeals) {
    const key = normalizeFoodName(meal.foodName);
    const existing = byFood.get(key);
    if (existing) {
      existing.quantity += meal.servings;
      // Keep the first non-empty foodId we see for grounding.
      if (!existing.foodId && meal.foodId) existing.foodId = meal.foodId;
    } else {
      byFood.set(key, { name: meal.foodName, foodId: meal.foodId, quantity: meal.servings });
    }
  }
  return [...byFood.values()].sort((a, b) => a.name.localeCompare(b.name));
}
