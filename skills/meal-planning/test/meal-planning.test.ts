import { describe, expect, it } from 'vitest';
import { aggregateGroceryList, normalizeFoodName, summarizeByDay, summarizeDay } from '../src/index.js';
import type { NutritionLogEntry, PlannedMeal } from '../src/index.js';

function planned(over: Partial<PlannedMeal>): PlannedMeal {
  return {
    id: 'p',
    userId: 'u1',
    date: '2026-07-04',
    slot: 'dinner',
    foodName: 'Pasta',
    servings: 1,
    createdAt: '',
    ...over,
  };
}

function logged(over: Partial<NutritionLogEntry>): NutritionLogEntry {
  return {
    id: 'e',
    userId: 'u1',
    date: '2026-07-04',
    foodName: 'Pasta',
    servings: 1,
    loggedAt: '',
    ...over,
  };
}

describe('aggregateGroceryList', () => {
  it('sums servings per normalized food name, sorted by name', () => {
    const items = aggregateGroceryList([
      planned({ foodName: 'Pasta', servings: 2 }),
      planned({ foodName: 'pasta', servings: 1 }),
      planned({ foodName: 'Tomato', servings: 3 }),
    ]);
    expect(items).toEqual([
      { name: 'Pasta', foodId: undefined, quantity: 3 },
      { name: 'Tomato', foodId: undefined, quantity: 3 },
    ]);
  });

  it('keeps the first non-empty foodId for grounding', () => {
    const items = aggregateGroceryList([
      planned({ foodName: 'Egg', servings: 1 }),
      planned({ foodName: 'egg', servings: 2, foodId: 'egg_id' }),
    ]);
    expect(items[0]).toEqual({ name: 'Egg', foodId: 'egg_id', quantity: 3 });
  });
});

describe('summarizeDay', () => {
  it('sums calories/macros, treating missing fields as 0', () => {
    const day = summarizeDay('2026-07-04', [
      logged({ calories: 500, proteinG: 20 }),
      logged({ calories: 300, carbsG: 40, fatG: 10 }),
    ]);
    expect(day.totalCalories).toBe(800);
    expect(day.totalProteinG).toBe(20);
    expect(day.totalCarbsG).toBe(40);
    expect(day.totalFatG).toBe(10);
  });
});

describe('summarizeByDay', () => {
  it('groups entries by date, newest first', () => {
    const days = summarizeByDay([
      logged({ date: '2026-07-03', calories: 100 }),
      logged({ date: '2026-07-04', calories: 200 }),
      logged({ date: '2026-07-04', calories: 50 }),
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-07-04', '2026-07-03']);
    expect(days[0]!.totalCalories).toBe(250);
  });
});

describe('normalizeFoodName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeFoodName('  Brown   Rice ')).toBe('brown rice');
  });
});
