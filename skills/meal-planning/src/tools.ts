// Meal planning tools — the units the Planner can call. Handlers close over injected
// ports only (ADR-0004: logic lives here, the AI never touches the DB directly).
// `get_nutrition_summary` is deliberately data-only: it hands the LLM clean totals
// so IT composes the reply — no rule-based diet advice lives here.

import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import type {
  DailyNutritionSummary,
  GroceryListItem,
  MealSlot,
  NutritionLogEntry,
  PlannedMeal,
} from './domain/types.js';
import { aggregateGroceryList } from './domain/grocery-aggregation.js';
import { normalizeFoodName, summarizeByDay } from './domain/nutrition.js';
import type { PlannedMealRepositoryPort } from './ports/planned-meal.port.js';
import type { NutritionLogRepositoryPort } from './ports/nutrition-log.port.js';
import type { NutritionProfileRepositoryPort } from './ports/nutrition-profile.port.js';
import type { FoodCatalogPort } from './ports/food-catalog.port.js';
import { MEAL_PLANNED, MEAL_FOOD_LOGGED, type MealPlannedPayload, type FoodLoggedPayload } from './surface.js';

export interface MealPlanningToolDeps {
  plannedMeals: PlannedMealRepositoryPort;
  nutritionLog: NutritionLogRepositoryPort;
  profiles: NutritionProfileRepositoryPort;
  catalog: FoodCatalogPort;
  newId: () => string;
  /** Injected clock — no hidden "now" (docs/02 §8). Defaults to real time. */
  now?: () => string;
  publish?: (event: DomainEvent) => Promise<void>;
}

interface PlanMealArgs {
  date: string;
  slot: MealSlot;
  foodName: string;
  servings?: number;
  notes?: string;
}
interface RemovePlannedMealArgs {
  plannedMealId: string;
}
interface GetWeekPlanArgs {
  weekStart?: string;
}
interface GenerateGroceryListArgs {
  weekStart?: string;
  weekEnd?: string;
}
interface LogFoodArgs {
  foodName: string;
  date?: string;
  slot?: MealSlot;
  servings?: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}
interface GetNutritionSummaryArgs {
  date?: string;
  lookbackDays?: number;
}

/** Monday-anchored ISO week containing `dateIso` (yyyy-mm-dd). */
function weekBounds(dateIso: string): { start: string; end: string } {
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const start = new Date(d.getTime() - dow * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function createMealPlanningTools(deps: MealPlanningToolDeps): Tool[] {
  const { newId } = deps;
  const now = () => deps.now?.() ?? new Date().toISOString();

  const planMeal: Tool<PlanMealArgs, { plannedMealId: string; matchedCatalogFood?: string }> = {
    name: 'meal.plan_meal',
    description:
      'Add a food to the plan for a given date and slot (breakfast/lunch/dinner/snack). ' +
      'Multiple foods per slot are allowed. Food names are freeform; the catalog is ' +
      'only used for grounding. servings defaults to 1.',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        foodName: { type: 'string' },
        servings: { type: 'number' },
        notes: { type: 'string' },
      },
      required: ['date', 'slot', 'foodName'],
    },
    outputSchema: {
      type: 'object',
      properties: { plannedMealId: { type: 'string' }, matchedCatalogFood: { type: 'string' } },
      required: ['plannedMealId'],
    },
    requiredCapability: 'meal.track',
    idempotent: false,
    requiresConfirmation: false,
    followUps: [
      { label: 'Generate grocery list', prompt: 'generate a grocery list from my meal plan' },
    ],
    handler: async (ctx: UnifiedContext, args: PlanMealArgs) => {
      const matched = await deps.catalog.findByName(normalizeFoodName(args.foodName));
      const meal: PlannedMeal = {
        id: newId(),
        userId: ctx.user.id,
        date: args.date.slice(0, 10),
        slot: args.slot,
        foodName: args.foodName,
        foodId: matched?.id,
        servings: args.servings ?? 1,
        notes: args.notes,
        createdAt: now(),
      };
      await deps.plannedMeals.addPlannedMeal(meal);

      if (deps.publish) {
        const payload: MealPlannedPayload = {
          plannedMealId: meal.id,
          date: meal.date,
          slot: meal.slot,
          foodName: meal.foodName,
        };
        await deps.publish({
          eventId: newId(),
          type: MEAL_PLANNED,
          userId: ctx.user.id,
          occurredAt: meal.createdAt,
          payload,
        });
      }

      return { plannedMealId: meal.id, matchedCatalogFood: matched?.name };
    },
  };

  const removePlannedMeal: Tool<RemovePlannedMealArgs, { removed: true }> = {
    name: 'meal.remove_planned_meal',
    description: 'Remove a food from the meal plan.',
    inputSchema: {
      type: 'object',
      properties: { plannedMealId: { type: 'string' } },
      required: ['plannedMealId'],
    },
    outputSchema: { type: 'object', properties: { removed: { type: 'boolean' } }, required: ['removed'] },
    requiredCapability: 'meal.track',
    idempotent: false,
    requiresConfirmation: true,
    handler: async (ctx: UnifiedContext, args: RemovePlannedMealArgs) => {
      await deps.plannedMeals.removePlannedMeal(ctx.user.id, args.plannedMealId);
      return { removed: true };
    },
  };

  const getWeekPlan: Tool<GetWeekPlanArgs, { weekStart: string; weekEnd: string; plannedMeals: PlannedMeal[] }> = {
    name: 'meal.get_week_plan',
    description:
      'Get the planned meals for a week (defaults to the current week, Monday-anchored). ' +
      'Returns DATA — the planned meals grouped by date/slot are yours to narrate.',
    inputSchema: { type: 'object', properties: { weekStart: { type: 'string' } } },
    outputSchema: { type: 'object' },
    requiredCapability: 'meal.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: GetWeekPlanArgs) => {
      const { start, end } = weekBounds(args.weekStart ?? now());
      const plannedMeals = await deps.plannedMeals.plannedMealsInRange(ctx.user.id, start, end);
      return { weekStart: start, weekEnd: end, plannedMeals };
    },
  };

  const generateGroceryList: Tool<
    GenerateGroceryListArgs,
    { weekStart: string; weekEnd: string; items: GroceryListItem[]; note: string }
  > = {
    name: 'meal.generate_grocery_list',
    description:
      'Aggregate all planned meals in a date range into a consolidated grocery list ' +
      '(servings summed per food). Returns DATA ONLY — it does not add anything to the ' +
      'Grocery skill\'s cart/list; present the list for the user to act on.',
    inputSchema: {
      type: 'object',
      properties: { weekStart: { type: 'string' }, weekEnd: { type: 'string' } },
    },
    outputSchema: { type: 'object' },
    requiredCapability: 'meal.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: GenerateGroceryListArgs) => {
      const bounds = weekBounds(args.weekStart ?? now());
      const start = args.weekStart?.slice(0, 10) ?? bounds.start;
      const end = args.weekEnd?.slice(0, 10) ?? bounds.end;
      const plannedMeals = await deps.plannedMeals.plannedMealsInRange(ctx.user.id, start, end);
      return {
        weekStart: start,
        weekEnd: end,
        items: aggregateGroceryList(plannedMeals),
        note: 'Derived from your planned meals. Nothing was added to your grocery cart.',
      };
    },
  };

  const logFood: Tool<LogFoodArgs, { entryId: string; matchedCatalogFood?: string }> = {
    name: 'meal.log_food',
    description:
      'Log a food you ate, with optional calories/macros. date defaults to today. If ' +
      'the food matches the catalog and no macros are given, catalog macros (scaled by ' +
      'servings) are used. Food names are freeform.',
    inputSchema: {
      type: 'object',
      properties: {
        foodName: { type: 'string' },
        date: { type: 'string' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        servings: { type: 'number' },
        calories: { type: 'number' },
        proteinG: { type: 'number' },
        carbsG: { type: 'number' },
        fatG: { type: 'number' },
      },
      required: ['foodName'],
    },
    outputSchema: {
      type: 'object',
      properties: { entryId: { type: 'string' }, matchedCatalogFood: { type: 'string' } },
      required: ['entryId'],
    },
    requiredCapability: 'meal.track',
    idempotent: false,
    requiresConfirmation: false,
    followUps: [{ label: "View today's nutrition", prompt: "show my nutrition summary for today" }],
    handler: async (ctx: UnifiedContext, args: LogFoodArgs) => {
      const servings = args.servings ?? 1;
      const matched = await deps.catalog.findByName(normalizeFoodName(args.foodName));
      const scale = (perServing?: number): number | undefined =>
        perServing != null ? perServing * servings : undefined;

      const entry: NutritionLogEntry = {
        id: newId(),
        userId: ctx.user.id,
        date: (args.date ?? now()).slice(0, 10),
        slot: args.slot,
        foodName: args.foodName,
        foodId: matched?.id,
        servings,
        calories: args.calories ?? scale(matched?.caloriesPerServing),
        proteinG: args.proteinG ?? scale(matched?.proteinG),
        carbsG: args.carbsG ?? scale(matched?.carbsG),
        fatG: args.fatG ?? scale(matched?.fatG),
        loggedAt: now(),
      };
      await deps.nutritionLog.addEntry(entry);

      if (deps.publish) {
        const payload: FoodLoggedPayload = {
          entryId: entry.id,
          foodName: entry.foodName,
          date: entry.date,
          calories: entry.calories,
        };
        await deps.publish({
          eventId: newId(),
          type: MEAL_FOOD_LOGGED,
          userId: ctx.user.id,
          occurredAt: entry.loggedAt,
          payload,
        });
      }

      return { entryId: entry.id, matchedCatalogFood: matched?.name };
    },
  };

  const getNutritionSummary: Tool<
    GetNutritionSummaryArgs,
    {
      hasAnyHistory: boolean;
      hasProfile: boolean;
      days: DailyNutritionSummary[];
      profile: import('./domain/types.js').NutritionProfile | undefined;
    }
  > = {
    name: 'meal.get_nutrition_summary',
    description:
      'Fetch structured nutrition totals (calories/macros per day) over a lookback ' +
      'window, plus the user\'s targets. Returns DATA ONLY — it does not itself judge ' +
      'the diet; compose the reply using this data and the profile targets. If ' +
      'hasAnyHistory and hasProfile are both false, ask about goals/targets first.',
    inputSchema: {
      type: 'object',
      properties: { date: { type: 'string' }, lookbackDays: { type: 'integer' } },
    },
    outputSchema: { type: 'object' },
    requiredCapability: 'meal.read',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext, args: GetNutritionSummaryArgs) => {
      const endIso = (args.date ?? now()).slice(0, 10);
      const lookbackDays = Math.max(1, args.lookbackDays ?? 7);
      const startIso = new Date(new Date(`${endIso}T00:00:00Z`).getTime() - (lookbackDays - 1) * 86400000)
        .toISOString()
        .slice(0, 10);

      const [entries, profile, hasAny] = await Promise.all([
        deps.nutritionLog.entriesInRange(ctx.user.id, startIso, endIso),
        deps.profiles.getProfile(ctx.user.id),
        deps.nutritionLog.hasAny(ctx.user.id),
      ]);

      return {
        hasAnyHistory: hasAny,
        hasProfile: profile != null,
        days: summarizeByDay(entries),
        profile,
      };
    },
  };

  return [planMeal, removePlannedMeal, getWeekPlan, generateGroceryList, logFood, getNutritionSummary];
}
