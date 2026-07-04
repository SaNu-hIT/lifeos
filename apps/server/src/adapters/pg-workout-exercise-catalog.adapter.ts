// Postgres-backed ExerciseCatalogPort — platform-owned seed/reference data, not user
// data, so this runs in service context (no RLS), same pattern as
// PgGroceryPriceCacheAdapter.

import type { DatabasePort } from '@lifeos/api';
import type { Equipment, Exercise, ExerciseCatalogPort, MuscleGroup } from '@lifeos/skill-workout';

interface ExerciseRow {
  id: string;
  name: string;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    primaryMuscle: row.primary_muscle,
    secondaryMuscles: row.secondary_muscles.length ? row.secondary_muscles : undefined,
    equipment: row.equipment,
  };
}

const EXERCISE_COLUMNS = 'id, name, primary_muscle, secondary_muscles, equipment';

export class PgWorkoutExerciseCatalogAdapter implements ExerciseCatalogPort {
  constructor(private readonly db: DatabasePort) {}

  async findByName(nameNormalized: string): Promise<Exercise | undefined> {
    const r = await this.db.query<ExerciseRow>(
      `select ${EXERCISE_COLUMNS} from workout.exercise_catalog where lower(name) = $1`,
      [nameNormalized],
    );
    return r.rows[0] ? toExercise(r.rows[0]) : undefined;
  }

  async search(query: string, limit = 10): Promise<Exercise[]> {
    const r = await this.db.query<ExerciseRow>(
      `select ${EXERCISE_COLUMNS} from workout.exercise_catalog
        where name ilike $1
        order by name asc
        limit $2`,
      [`%${query}%`, limit],
    );
    return r.rows.map(toExercise);
  }

  async list(filter?: { muscle?: MuscleGroup; equipment?: Equipment }): Promise<Exercise[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter?.muscle) {
      params.push(filter.muscle);
      conditions.push(`primary_muscle = $${params.length}`);
    }
    if (filter?.equipment) {
      params.push(filter.equipment);
      conditions.push(`equipment = $${params.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
    const r = await this.db.query<ExerciseRow>(
      `select ${EXERCISE_COLUMNS} from workout.exercise_catalog ${where} order by name asc`,
      params,
    );
    return r.rows.map(toExercise);
  }
}
