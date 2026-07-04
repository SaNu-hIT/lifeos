// Postgres-backed WorkoutProfileRepositoryPort. User-owned data — runs in USER
// context so workout.user_profile's RLS policy (0024_workout_profile.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { WorkoutProfile, WorkoutProfileRepositoryPort } from '@lifeos/skill-workout';

interface ProfileRow {
  user_id: string;
  frequency_per_week: number;
  goals: string[];
  experience: WorkoutProfile['experience'];
  available_equipment: string[];
  preferred_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): WorkoutProfile {
  return {
    userId: row.user_id,
    frequencyPerWeek: row.frequency_per_week,
    goals: row.goals as WorkoutProfile['goals'],
    experience: row.experience,
    availableEquipment: row.available_equipment as WorkoutProfile['availableEquipment'],
    preferredDurationMinutes: row.preferred_duration_minutes ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PgWorkoutProfileRepository implements WorkoutProfileRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async getProfile(userId: string): Promise<WorkoutProfile | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ProfileRow>(
          `select user_id, frequency_per_week, goals, experience, available_equipment,
                  preferred_duration_minutes, created_at, updated_at
             from workout.user_profile
            where user_id = $1`,
          [userId],
        );
        return r.rows[0] ? toProfile(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async saveProfile(profile: WorkoutProfile): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into workout.user_profile
             (user_id, frequency_per_week, goals, experience, available_equipment,
              preferred_duration_minutes, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict (user_id)
           do update set frequency_per_week = excluded.frequency_per_week,
                          goals = excluded.goals,
                          experience = excluded.experience,
                          available_equipment = excluded.available_equipment,
                          preferred_duration_minutes = excluded.preferred_duration_minutes,
                          updated_at = excluded.updated_at`,
          [
            profile.userId,
            profile.frequencyPerWeek,
            profile.goals,
            profile.experience,
            profile.availableEquipment,
            profile.preferredDurationMinutes ?? null,
            profile.createdAt,
            profile.updatedAt,
          ],
        );
      },
      { as: 'user', userId: profile.userId },
    );
  }
}
