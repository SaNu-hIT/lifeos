// Postgres-backed BudgetLimitRepositoryPort. User-owned data — runs in USER context
// so finance.budget_limits' RLS (0033) is enforced. Keyed by (user_id, category_name).

import type { DatabasePort } from '@lifeos/api';
import type { BudgetLimit, BudgetLimitRepositoryPort } from '@lifeos/skill-finance';

interface BudgetRow {
  user_id: string;
  category_name: string;
  monthly_limit_minor: string | number;
  currency: string;
  created_at: string;
  updated_at: string;
}

function toBudget(row: BudgetRow): BudgetLimit {
  return {
    userId: row.user_id,
    categoryName: row.category_name,
    monthlyLimitMinor: Number(row.monthly_limit_minor),
    currency: row.currency,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PgFinanceBudgetLimitRepository implements BudgetLimitRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async upsert(budget: BudgetLimit): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into finance.budget_limits
             (user_id, category_name, monthly_limit_minor, currency, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (user_id, category_name)
           do update set monthly_limit_minor = excluded.monthly_limit_minor,
                          currency = excluded.currency,
                          updated_at = excluded.updated_at`,
          [
            budget.userId,
            budget.categoryName,
            budget.monthlyLimitMinor,
            budget.currency,
            budget.createdAt,
            budget.updatedAt,
          ],
        );
      },
      { as: 'user', userId: budget.userId },
    );
  }

  async listForUser(userId: string): Promise<BudgetLimit[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<BudgetRow>(
          `select user_id, category_name, monthly_limit_minor, currency, created_at, updated_at
             from finance.budget_limits
            where user_id = $1
            order by category_name asc`,
          [userId],
        );
        return r.rows.map(toBudget);
      },
      { as: 'user', userId },
    );
  }
}
