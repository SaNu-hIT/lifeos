// Postgres-backed NutritionProfileRepositoryPort. User-owned data — runs in USER
// context so meal_planning.user_profile's RLS (0037) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { NutritionProfile, NutritionProfileRepositoryPort } from '@lifeos/skill-meal-planning';

interface ProfileRow {
  user_id: string;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
  dietary_restrictions: string[];
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): NutritionProfile {
  return {
    userId: row.user_id,
    dailyCalorieTarget: row.daily_calorie_target ?? undefined,
    proteinTargetG: row.protein_target_g ?? undefined,
    carbsTargetG: row.carbs_target_g ?? undefined,
    fatTargetG: row.fat_target_g ?? undefined,
    dietaryRestrictions: row.dietary_restrictions.length > 0 ? row.dietary_restrictions : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PgMealProfileRepository implements NutritionProfileRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async getProfile(userId: string): Promise<NutritionProfile | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ProfileRow>(
          `select user_id, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g,
                  dietary_restrictions, created_at, updated_at
             from meal_planning.user_profile
            where user_id = $1`,
          [userId],
        );
        return r.rows[0] ? toProfile(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async saveProfile(profile: NutritionProfile): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into meal_planning.user_profile
             (user_id, daily_calorie_target, protein_target_g, carbs_target_g, fat_target_g,
              dietary_restrictions, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (user_id)
           do update set daily_calorie_target = excluded.daily_calorie_target,
                          protein_target_g = excluded.protein_target_g,
                          carbs_target_g = excluded.carbs_target_g,
                          fat_target_g = excluded.fat_target_g,
                          dietary_restrictions = excluded.dietary_restrictions,
                          updated_at = excluded.updated_at`,
          [
            profile.userId,
            profile.dailyCalorieTarget ?? null,
            profile.proteinTargetG ?? null,
            profile.carbsTargetG ?? null,
            profile.fatTargetG ?? null,
            profile.dietaryRestrictions ?? [],
            profile.createdAt,
            profile.updatedAt,
          ],
        );
      },
      { as: 'user', userId: profile.userId },
    );
  }
}
