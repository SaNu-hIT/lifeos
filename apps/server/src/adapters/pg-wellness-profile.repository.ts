// Postgres-backed WellnessProfileRepositoryPort. User-owned data — runs in USER
// context so wellness.user_profile's RLS policy (0028_wellness_profile.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { SupplyItem, TrackingGoal, WellnessProfile, WellnessProfileRepositoryPort } from '@lifeos/skill-wellness';

interface ProfileRow {
  user_id: string;
  tracking_goals: TrackingGoal[];
  average_cycle_length_days: number | null;
  supply_list: SupplyItem[];
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): WellnessProfile {
  return {
    userId: row.user_id,
    trackingGoals: row.tracking_goals,
    averageCycleLengthDays: row.average_cycle_length_days ?? undefined,
    supplyList: row.supply_list,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PgWellnessProfileRepository implements WellnessProfileRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async getProfile(userId: string): Promise<WellnessProfile | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ProfileRow>(
          `select user_id, tracking_goals, average_cycle_length_days, supply_list, created_at, updated_at
             from wellness.user_profile
            where user_id = $1`,
          [userId],
        );
        return r.rows[0] ? toProfile(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async saveProfile(profile: WellnessProfile): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into wellness.user_profile
             (user_id, tracking_goals, average_cycle_length_days, supply_list, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (user_id)
           do update set tracking_goals = excluded.tracking_goals,
                          average_cycle_length_days = excluded.average_cycle_length_days,
                          supply_list = excluded.supply_list,
                          updated_at = excluded.updated_at`,
          [
            profile.userId,
            profile.trackingGoals,
            profile.averageCycleLengthDays ?? null,
            JSON.stringify(profile.supplyList),
            profile.createdAt,
            profile.updatedAt,
          ],
        );
      },
      { as: 'user', userId: profile.userId },
    );
  }
}
