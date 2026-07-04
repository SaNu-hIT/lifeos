// Postgres-backed FinanceProfileRepositoryPort. User-owned data — runs in USER
// context so finance.user_profile's RLS (0033) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { FinanceProfile, FinanceProfileRepositoryPort } from '@lifeos/skill-finance';

interface ProfileRow {
  user_id: string;
  currency: string;
  monthly_income_minor: string | number | null;
  savings_goal_minor: string | number | null;
  created_at: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): FinanceProfile {
  return {
    userId: row.user_id,
    currency: row.currency,
    monthlyIncomeMinor: row.monthly_income_minor != null ? Number(row.monthly_income_minor) : undefined,
    savingsGoalMinor: row.savings_goal_minor != null ? Number(row.savings_goal_minor) : undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PgFinanceProfileRepository implements FinanceProfileRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async getProfile(userId: string): Promise<FinanceProfile | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ProfileRow>(
          `select user_id, currency, monthly_income_minor, savings_goal_minor, created_at, updated_at
             from finance.user_profile
            where user_id = $1`,
          [userId],
        );
        return r.rows[0] ? toProfile(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async saveProfile(profile: FinanceProfile): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into finance.user_profile
             (user_id, currency, monthly_income_minor, savings_goal_minor, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (user_id)
           do update set currency = excluded.currency,
                          monthly_income_minor = excluded.monthly_income_minor,
                          savings_goal_minor = excluded.savings_goal_minor,
                          updated_at = excluded.updated_at`,
          [
            profile.userId,
            profile.currency,
            profile.monthlyIncomeMinor ?? null,
            profile.savingsGoalMinor ?? null,
            profile.createdAt,
            profile.updatedAt,
          ],
        );
      },
      { as: 'user', userId: profile.userId },
    );
  }
}
