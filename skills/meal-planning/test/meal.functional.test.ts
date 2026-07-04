// End-to-end functional test: drives the real Meal Planning tool handlers through
// in-memory repositories, proving plan → grocery-list and log → nutrition-summary
// work as a user would exercise them (catalog macro lookup included).

import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import {
  createMealPlanningSkill,
  type FoodCatalogPort,
  type FoodItem,
  type NutritionLogEntry,
  type NutritionLogRepositoryPort,
  type NutritionProfile,
  type NutritionProfileRepositoryPort,
  type PlannedMeal,
  type PlannedMealRepositoryPort,
} from '../src/index.js';

class InMemoryPlanned implements PlannedMealRepositoryPort {
  private rows = new Map<string, PlannedMeal>();
  async addPlannedMeal(m: PlannedMeal): Promise<void> {
    this.rows.set(m.id, m);
  }
  async removePlannedMeal(userId: string, id: string): Promise<void> {
    const m = this.rows.get(id);
    if (m && m.userId === userId) this.rows.delete(id);
  }
  async plannedMealsInRange(userId: string, fromDate: string, toDate: string): Promise<PlannedMeal[]> {
    return [...this.rows.values()]
      .filter((m) => m.userId === userId && m.date >= fromDate && m.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
  }
}

class InMemoryNutrition implements NutritionLogRepositoryPort {
  private rows: NutritionLogEntry[] = [];
  async addEntry(e: NutritionLogEntry): Promise<void> {
    this.rows.push(e);
  }
  async entriesInRange(userId: string, fromDate: string, toDate: string): Promise<NutritionLogEntry[]> {
    return this.rows
      .filter((e) => e.userId === userId && e.date >= fromDate && e.date <= toDate)
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  async hasAny(userId: string): Promise<boolean> {
    return this.rows.some((e) => e.userId === userId);
  }
}

class InMemoryProfiles implements NutritionProfileRepositoryPort {
  private rows = new Map<string, NutritionProfile>();
  async getProfile(userId: string): Promise<NutritionProfile | undefined> {
    return this.rows.get(userId);
  }
  async saveProfile(p: NutritionProfile): Promise<void> {
    this.rows.set(p.userId, p);
  }
}

const CATALOG: FoodItem[] = [
  { id: 'pasta', name: 'Pasta', caloriesPerServing: 220, proteinG: 8, carbsG: 43, fatG: 1, defaultUnit: 'cup' },
  { id: 'egg', name: 'Egg', caloriesPerServing: 78, proteinG: 6, carbsG: 1, fatG: 5, defaultUnit: 'piece' },
];

class InMemoryCatalog implements FoodCatalogPort {
  async findByName(nameNormalized: string): Promise<FoodItem | undefined> {
    return CATALOG.find((f) => f.name.toLowerCase() === nameNormalized);
  }
  async search(query: string): Promise<FoodItem[]> {
    return CATALOG.filter((f) => f.name.toLowerCase().includes(query.toLowerCase()));
  }
  async list(): Promise<FoodItem[]> {
    return CATALOG;
  }
}

function ctxFor(userId: string, nowIso = '2026-07-04T12:00:00.000Z'): UnifiedContext {
  return {
    user: { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['meal.read', 'meal.track'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'meal',
    now: nowIso,
  };
}

function build() {
  const events: DomainEvent[] = [];
  let seq = 0;
  const manifest = createMealPlanningSkill({
    plannedMeals: new InMemoryPlanned(),
    nutritionLog: new InMemoryNutrition(),
    profiles: new InMemoryProfiles(),
    catalog: new InMemoryCatalog(),
    newId: () => `id-${++seq}`,
    now: () => '2026-07-04T12:00:00.000Z',
    publish: async (e) => {
      events.push(e);
    },
  });
  return { manifest, events };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

describe('@lifeos/skill-meal-planning (functional)', () => {
  it('passes the skill contract', () => {
    runSkillContractTests(build().manifest);
  });

  it('plans meals and generates a consolidated grocery list (servings summed)', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u1');

    // 2026-07-04 is a Saturday; the current Monday-anchored week covers it.
    await tool(tools, 'meal.plan_meal').handler(ctx, { date: '2026-07-04', slot: 'dinner', foodName: 'Pasta', servings: 2 });
    await tool(tools, 'meal.plan_meal').handler(ctx, { date: '2026-07-04', slot: 'lunch', foodName: 'pasta', servings: 1 });
    await tool(tools, 'meal.plan_meal').handler(ctx, { date: '2026-07-04', slot: 'breakfast', foodName: 'Egg', servings: 3 });

    const week = (await tool(tools, 'meal.get_week_plan').handler(ctx, {})) as { plannedMeals: PlannedMeal[] };
    expect(week.plannedMeals).toHaveLength(3);

    const grocery = (await tool(tools, 'meal.generate_grocery_list').handler(ctx, {})) as {
      items: { name: string; quantity: number }[];
    };
    const pasta = grocery.items.find((i) => i.name.toLowerCase() === 'pasta')!;
    expect(pasta.quantity).toBe(3); // 2 + 1 summed across case-insensitive name
    const egg = grocery.items.find((i) => i.name === 'Egg')!;
    expect(egg.quantity).toBe(3);
  });

  it('logs food with catalog macro lookup and summarizes the day', async () => {
    const { manifest, events } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u2');

    // No macros passed → pulled from catalog and scaled by servings (2 × Pasta).
    await tool(tools, 'meal.log_food').handler(ctx, { foodName: 'Pasta', servings: 2, slot: 'dinner' });
    // Freeform food with explicit calories.
    await tool(tools, 'meal.log_food').handler(ctx, { foodName: 'Mango Lassi', calories: 250 });

    const summary = (await tool(tools, 'meal.get_nutrition_summary').handler(ctx, {})) as {
      hasAnyHistory: boolean;
      days: { date: string; totalCalories: number; totalProteinG: number }[];
    };
    expect(summary.hasAnyHistory).toBe(true);
    const today = summary.days.find((d) => d.date === '2026-07-04')!;
    expect(today.totalCalories).toBe(220 * 2 + 250); // 690
    expect(today.totalProteinG).toBe(8 * 2); // 16 from pasta, lassi had none
    expect(events.some((e) => e.type === 'meal.food_logged')).toBe(true);
  });

  it('removes a planned meal', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u3');

    const { plannedMealId } = (await tool(tools, 'meal.plan_meal').handler(ctx, {
      date: '2026-07-04',
      slot: 'snack',
      foodName: 'Apple',
    })) as { plannedMealId: string };

    await tool(tools, 'meal.remove_planned_meal').handler(ctx, { plannedMealId });
    const week = (await tool(tools, 'meal.get_week_plan').handler(ctx, {})) as { plannedMeals: PlannedMeal[] };
    expect(week.plannedMeals).toHaveLength(0);
  });
});
