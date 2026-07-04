// Postgres-backed PlannedMealRepositoryPort. User-owned data — runs in USER context
// so meal_planning.planned_meals' RLS (0035) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { MealSlot, PlannedMeal, PlannedMealRepositoryPort } from '@lifeos/skill-meal-planning';

interface PlannedMealRow {
  id: string;
  user_id: string;
  meal_date: string | Date;
  slot: MealSlot;
  food_name: string;
  food_id: string | null;
  servings: string | number;
  notes: string | null;
  created_at: string;
}

/** node-pg returns `date` columns as a Date at LOCAL midnight; format local Y-M-D so
 *  the calendar day is preserved regardless of timezone. Tolerates a raw string too. */
function toDateOnly(v: string | Date): string {
  if (typeof v === 'string') return v.slice(0, 10);
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, '0');
  const d = String(v.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toPlannedMeal(row: PlannedMealRow): PlannedMeal {
  return {
    id: row.id,
    userId: row.user_id,
    date: toDateOnly(row.meal_date),
    slot: row.slot,
    foodName: row.food_name,
    foodId: row.food_id ?? undefined,
    servings: Number(row.servings),
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const PLANNED_COLUMNS = 'id, user_id, meal_date, slot, food_name, food_id, servings, notes, created_at';

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class PgMealPlannedMealRepository implements PlannedMealRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async addPlannedMeal(meal: PlannedMeal): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into meal_planning.planned_meals
             (id, user_id, meal_date, slot, food_name, food_name_normalized, food_id, servings, notes, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            meal.id,
            meal.userId,
            meal.date,
            meal.slot,
            meal.foodName,
            normalize(meal.foodName),
            meal.foodId ?? null,
            meal.servings,
            meal.notes ?? null,
            meal.createdAt,
          ],
        );
      },
      { as: 'user', userId: meal.userId },
    );
  }

  async removePlannedMeal(userId: string, plannedMealId: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('delete from meal_planning.planned_meals where user_id = $1 and id = $2', [
          userId,
          plannedMealId,
        ]);
      },
      { as: 'user', userId },
    );
  }

  async plannedMealsInRange(userId: string, fromDate: string, toDate: string): Promise<PlannedMeal[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<PlannedMealRow>(
          `select ${PLANNED_COLUMNS} from meal_planning.planned_meals
            where user_id = $1 and meal_date between $2 and $3
            order by meal_date asc, slot asc`,
          [userId, fromDate, toDate],
        );
        return r.rows.map(toPlannedMeal);
      },
      { as: 'user', userId },
    );
  }
}
