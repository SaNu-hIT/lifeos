// Postgres-backed FoodCatalogPort — platform-owned seed/reference data, not user
// data, so this runs in service context (no RLS), same pattern as
// PgWorkoutExerciseCatalogAdapter.

import type { DatabasePort } from '@lifeos/api';
import type { FoodCatalogPort, FoodItem } from '@lifeos/skill-meal-planning';

interface FoodRow {
  id: string;
  name: string;
  calories_per_serving: string | number | null;
  protein_g: string | number | null;
  carbs_g: string | number | null;
  fat_g: string | number | null;
  default_unit: string | null;
}

function num(v: string | number | null): number | undefined {
  return v != null ? Number(v) : undefined;
}

function toFood(row: FoodRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    caloriesPerServing: num(row.calories_per_serving),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatG: num(row.fat_g),
    defaultUnit: row.default_unit ?? undefined,
  };
}

const FOOD_COLUMNS = 'id, name, calories_per_serving, protein_g, carbs_g, fat_g, default_unit';

export class PgMealFoodCatalogAdapter implements FoodCatalogPort {
  constructor(private readonly db: DatabasePort) {}

  async findByName(nameNormalized: string): Promise<FoodItem | undefined> {
    const r = await this.db.query<FoodRow>(
      `select ${FOOD_COLUMNS} from meal_planning.food_catalog where lower(name) = $1`,
      [nameNormalized],
    );
    return r.rows[0] ? toFood(r.rows[0]) : undefined;
  }

  async search(query: string, limit = 10): Promise<FoodItem[]> {
    const r = await this.db.query<FoodRow>(
      `select ${FOOD_COLUMNS} from meal_planning.food_catalog
        where name ilike $1
        order by name asc
        limit $2`,
      [`%${query}%`, limit],
    );
    return r.rows.map(toFood);
  }

  async list(): Promise<FoodItem[]> {
    const r = await this.db.query<FoodRow>(
      `select ${FOOD_COLUMNS} from meal_planning.food_catalog order by name asc`,
    );
    return r.rows.map(toFood);
  }
}
