// Postgres-backed NutritionLogRepositoryPort. User-owned data — runs in USER context
// so meal_planning.nutrition_log's RLS (0036) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { MealSlot, NutritionLogEntry, NutritionLogRepositoryPort } from '@lifeos/skill-meal-planning';

interface NutritionRow {
  id: string;
  user_id: string;
  entry_date: string | Date;
  slot: MealSlot | null;
  food_name: string;
  food_id: string | null;
  servings: string | number;
  calories: string | number | null;
  protein_g: string | number | null;
  carbs_g: string | number | null;
  fat_g: string | number | null;
  logged_at: string;
}

function num(v: string | number | null): number | undefined {
  return v != null ? Number(v) : undefined;
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

function toEntry(row: NutritionRow): NutritionLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    date: toDateOnly(row.entry_date),
    slot: row.slot ?? undefined,
    foodName: row.food_name,
    foodId: row.food_id ?? undefined,
    servings: Number(row.servings),
    calories: num(row.calories),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    loggedAt: new Date(row.logged_at).toISOString(),
  };
}

const NUTRITION_COLUMNS =
  'id, user_id, entry_date, slot, food_name, food_id, servings, calories, protein_g, carbs_g, fat_g, logged_at';

export class PgMealNutritionLogRepository implements NutritionLogRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async addEntry(entry: NutritionLogEntry): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into meal_planning.nutrition_log
             (id, user_id, entry_date, slot, food_name, food_id, servings, calories, protein_g, carbs_g, fat_g, logged_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            entry.id,
            entry.userId,
            entry.date,
            entry.slot ?? null,
            entry.foodName,
            entry.foodId ?? null,
            entry.servings,
            entry.calories ?? null,
            entry.proteinG ?? null,
            entry.carbsG ?? null,
            entry.fatG ?? null,
            entry.loggedAt,
          ],
        );
      },
      { as: 'user', userId: entry.userId },
    );
  }

  async entriesInRange(userId: string, fromDate: string, toDate: string): Promise<NutritionLogEntry[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<NutritionRow>(
          `select ${NUTRITION_COLUMNS} from meal_planning.nutrition_log
            where user_id = $1 and entry_date between $2 and $3
            order by entry_date desc, logged_at desc`,
          [userId, fromDate, toDate],
        );
        return r.rows.map(toEntry);
      },
      { as: 'user', userId },
    );
  }

  async hasAny(userId: string): Promise<boolean> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<{ exists: boolean }>(
          'select exists(select 1 from meal_planning.nutrition_log where user_id = $1) as exists',
          [userId],
        );
        return r.rows[0]?.exists ?? false;
      },
      { as: 'user', userId },
    );
  }
}
