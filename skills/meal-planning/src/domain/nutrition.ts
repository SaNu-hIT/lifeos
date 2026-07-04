// Pure nutrition math — no I/O, no hidden clock. Food names are matched on a
// normalized key, the same normalization Workout uses for exercise names.

import type { DailyNutritionSummary, NutritionLogEntry } from './types.js';

export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Sum calories/macros across a day's entries. Missing macro fields count as 0. */
export function summarizeDay(date: string, entries: NutritionLogEntry[]): DailyNutritionSummary {
  let totalCalories = 0;
  let totalProteinG = 0;
  let totalCarbsG = 0;
  let totalFatG = 0;
  for (const e of entries) {
    totalCalories += e.calories ?? 0;
    totalProteinG += e.proteinG ?? 0;
    totalCarbsG += e.carbsG ?? 0;
    totalFatG += e.fatG ?? 0;
  }
  return { date, totalCalories, totalProteinG, totalCarbsG, totalFatG, entries };
}

/** Group entries by date and summarize each, newest day first. */
export function summarizeByDay(entries: NutritionLogEntry[]): DailyNutritionSummary[] {
  const byDate = new Map<string, NutritionLogEntry[]>();
  for (const e of entries) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, dayEntries]) => summarizeDay(date, dayEntries));
}
