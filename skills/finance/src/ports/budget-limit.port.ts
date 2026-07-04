import type { BudgetLimit } from '../domain/types.js';

export interface BudgetLimitRepositoryPort {
  /** Upsert by (userId, categoryName). */
  upsert(budget: BudgetLimit): Promise<void>;
  listForUser(userId: string): Promise<BudgetLimit[]>;
}
