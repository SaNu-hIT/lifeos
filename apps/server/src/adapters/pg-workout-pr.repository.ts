// Postgres-backed WorkoutPrRepositoryPort. User-owned data — runs in USER context
// so workout.personal_records' RLS policy (0023_workout_prs.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { PersonalRecord, WorkoutPrRepositoryPort } from '@lifeos/skill-workout';

interface PrRow {
  id: string;
  user_id: string;
  exercise_name_normalized: string;
  best_weight_kg: string | number;
  best_weight_reps: number;
  best_volume: string | number;
  best_volume_set_weight_kg: string | number;
  best_volume_set_reps: number;
  achieved_at: string;
  source_set_id: string;
}

function toPr(row: PrRow): PersonalRecord {
  return {
    id: row.id,
    userId: row.user_id,
    exerciseName: row.exercise_name_normalized,
    bestWeightKg: Number(row.best_weight_kg),
    bestWeightReps: row.best_weight_reps,
    bestVolume: Number(row.best_volume),
    bestVolumeSetWeightKg: Number(row.best_volume_set_weight_kg),
    bestVolumeSetReps: row.best_volume_set_reps,
    achievedAt: new Date(row.achieved_at).toISOString(),
    sourceSetId: row.source_set_id,
  };
}

export class PgWorkoutPrRepository implements WorkoutPrRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async getPr(userId: string, exerciseNameNormalized: string): Promise<PersonalRecord | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<PrRow>(
          `select id, user_id, exercise_name_normalized, best_weight_kg, best_weight_reps,
                  best_volume, best_volume_set_weight_kg, best_volume_set_reps, achieved_at, source_set_id
             from workout.personal_records
            where user_id = $1 and exercise_name_normalized = $2`,
          [userId, exerciseNameNormalized],
        );
        return r.rows[0] ? toPr(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async upsertPr(record: PersonalRecord): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into workout.personal_records
             (id, user_id, exercise_name_normalized, best_weight_kg, best_weight_reps,
              best_volume, best_volume_set_weight_kg, best_volume_set_reps, achieved_at, source_set_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           on conflict (user_id, exercise_name_normalized)
           do update set best_weight_kg = excluded.best_weight_kg,
                          best_weight_reps = excluded.best_weight_reps,
                          best_volume = excluded.best_volume,
                          best_volume_set_weight_kg = excluded.best_volume_set_weight_kg,
                          best_volume_set_reps = excluded.best_volume_set_reps,
                          achieved_at = excluded.achieved_at,
                          source_set_id = excluded.source_set_id`,
          [
            record.id,
            record.userId,
            record.exerciseName,
            record.bestWeightKg,
            record.bestWeightReps,
            record.bestVolume,
            record.bestVolumeSetWeightKg,
            record.bestVolumeSetReps,
            record.achievedAt,
            record.sourceSetId,
          ],
        );
      },
      { as: 'user', userId: record.userId },
    );
  }

  async listPrs(userId: string): Promise<PersonalRecord[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<PrRow>(
          `select id, user_id, exercise_name_normalized, best_weight_kg, best_weight_reps,
                  best_volume, best_volume_set_weight_kg, best_volume_set_reps, achieved_at, source_set_id
             from workout.personal_records
            where user_id = $1`,
          [userId],
        );
        return r.rows.map(toPr);
      },
      { as: 'user', userId },
    );
  }
}
