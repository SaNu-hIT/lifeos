// Postgres-backed WorkoutSetRepositoryPort. User-owned data — runs in USER context
// so workout.sets' RLS policy (0022_workout_sessions.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { MuscleGroup, SetEntry, WorkoutSetRepositoryPort } from '@lifeos/skill-workout';

interface SetRow {
  id: string;
  session_id: string;
  user_id: string;
  exercise_name: string;
  exercise_name_normalized: string;
  exercise_id: string | null;
  set_number: number;
  weight_kg: string | number;
  reps: number;
  rpe: string | number | null;
  notes: string | null;
  is_pr: boolean;
  pr_kind: 'weight' | 'volume' | 'both' | null;
  created_at: string;
}

function toSet(row: SetRow): SetEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    exerciseName: row.exercise_name,
    exerciseId: row.exercise_id ?? undefined,
    setNumber: row.set_number,
    weightKg: Number(row.weight_kg),
    reps: row.reps,
    rpe: row.rpe != null ? Number(row.rpe) : undefined,
    notes: row.notes ?? undefined,
    isPr: row.is_pr,
    prKind: row.pr_kind ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const SET_COLUMNS = `id, session_id, user_id, exercise_name, exercise_name_normalized,
  exercise_id, set_number, weight_kg, reps, rpe, notes, is_pr, pr_kind, created_at`;

export class PgWorkoutSetRepository implements WorkoutSetRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async addSet(set: SetEntry): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into workout.sets
             (id, session_id, user_id, exercise_name, exercise_name_normalized,
              exercise_id, set_number, weight_kg, reps, rpe, notes, is_pr, pr_kind, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            set.id,
            set.sessionId,
            set.userId,
            set.exerciseName,
            set.exerciseName.trim().toLowerCase().replace(/\s+/g, ' '),
            set.exerciseId ?? null,
            set.setNumber,
            set.weightKg,
            set.reps,
            set.rpe ?? null,
            set.notes ?? null,
            set.isPr,
            set.prKind ?? null,
            set.createdAt,
          ],
        );
      },
      { as: 'user', userId: set.userId },
    );
  }

  async updateSet(
    userId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'rpe' | 'notes'>>,
  ): Promise<SetEntry | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SetRow>(
          `update workout.sets
              set weight_kg = coalesce($3, weight_kg),
                  reps = coalesce($4, reps),
                  rpe = coalesce($5, rpe),
                  notes = coalesce($6, notes)
            where user_id = $1 and id = $2
            returning ${SET_COLUMNS}`,
          [userId, setId, patch.weightKg ?? null, patch.reps ?? null, patch.rpe ?? null, patch.notes ?? null],
        );
        return r.rows[0] ? toSet(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async deleteSet(userId: string, setId: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('delete from workout.sets where user_id = $1 and id = $2', [userId, setId]);
      },
      { as: 'user', userId },
    );
  }

  async getSet(userId: string, setId: string): Promise<SetEntry | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SetRow>(
          `select ${SET_COLUMNS} from workout.sets where user_id = $1 and id = $2`,
          [userId, setId],
        );
        return r.rows[0] ? toSet(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async setsForSession(userId: string, sessionId: string): Promise<SetEntry[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SetRow>(
          `select ${SET_COLUMNS} from workout.sets
            where user_id = $1 and session_id = $2
            order by created_at asc`,
          [userId, sessionId],
        );
        return r.rows.map(toSet);
      },
      { as: 'user', userId },
    );
  }

  async recentSetsForExercise(
    userId: string,
    exerciseNameNormalized: string,
    limit: number,
  ): Promise<SetEntry[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SetRow>(
          `select ${SET_COLUMNS} from workout.sets
            where user_id = $1 and exercise_name_normalized = $2
            order by created_at desc
            limit $3`,
          [userId, exerciseNameNormalized, limit],
        );
        return r.rows.map(toSet);
      },
      { as: 'user', userId },
    );
  }

  async lastPerformedByMuscle(
    userId: string,
    muscles: MuscleGroup[],
  ): Promise<Partial<Record<MuscleGroup, string>>> {
    return this.db.transaction(
      async (tx) => {
        // Freeform sets with no matched exercise_id don't join to the catalog and so
        // don't contribute to muscle-group recency — documented gap (grounding-only
        // catalog, not a source of truth for muscle mapping).
        const r = await tx.query<{ primary_muscle: MuscleGroup; last_performed: string }>(
          `select c.primary_muscle, max(s.created_at) as last_performed
             from workout.sets s
             join workout.exercise_catalog c on c.id = s.exercise_id
            where s.user_id = $1 and c.primary_muscle = any($2)
            group by c.primary_muscle`,
          [userId, muscles],
        );
        const result: Partial<Record<MuscleGroup, string>> = {};
        for (const row of r.rows) {
          result[row.primary_muscle] = new Date(row.last_performed).toISOString();
        }
        return result;
      },
      { as: 'user', userId },
    );
  }
}
