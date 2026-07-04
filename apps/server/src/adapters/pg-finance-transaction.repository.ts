// Postgres-backed TransactionRepositoryPort. User-owned data — runs in USER context
// so finance.transactions' RLS policy (0031_finance_transactions.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { Transaction, TransactionRepositoryPort, TransactionType } from '@lifeos/skill-finance';

interface TransactionRow {
  id: string;
  user_id: string;
  type: TransactionType;
  amount_minor: string | number;
  currency: string;
  category_name: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
}

function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    categoryName: row.category_name,
    description: row.description ?? undefined,
    occurredAt: new Date(row.occurred_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const TXN_COLUMNS = 'id, user_id, type, amount_minor, currency, category_name, description, occurred_at, created_at';

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export class PgFinanceTransactionRepository implements TransactionRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async addTransaction(transaction: Transaction): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into finance.transactions
             (id, user_id, type, amount_minor, currency, category_name, category_name_normalized,
              description, occurred_at, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            transaction.id,
            transaction.userId,
            transaction.type,
            transaction.amountMinor,
            transaction.currency,
            transaction.categoryName,
            normalize(transaction.categoryName),
            transaction.description ?? null,
            transaction.occurredAt,
            transaction.createdAt,
          ],
        );
      },
      { as: 'user', userId: transaction.userId },
    );
  }

  async updateTransaction(
    userId: string,
    transactionId: string,
    patch: Partial<Pick<Transaction, 'amountMinor' | 'categoryName' | 'description' | 'occurredAt' | 'type'>>,
  ): Promise<Transaction | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<TransactionRow>(
          `update finance.transactions set
             amount_minor = coalesce($3, amount_minor),
             type = coalesce($4, type),
             category_name = coalesce($5, category_name),
             category_name_normalized = coalesce($6, category_name_normalized),
             description = coalesce($7, description),
             occurred_at = coalesce($8, occurred_at)
           where user_id = $1 and id = $2
           returning ${TXN_COLUMNS}`,
          [
            userId,
            transactionId,
            patch.amountMinor ?? null,
            patch.type ?? null,
            patch.categoryName ?? null,
            patch.categoryName != null ? normalize(patch.categoryName) : null,
            patch.description ?? null,
            patch.occurredAt ?? null,
          ],
        );
        return r.rows[0] ? toTransaction(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async deleteTransaction(userId: string, transactionId: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('delete from finance.transactions where user_id = $1 and id = $2', [userId, transactionId]);
      },
      { as: 'user', userId },
    );
  }

  async getTransaction(userId: string, transactionId: string): Promise<Transaction | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<TransactionRow>(
          `select ${TXN_COLUMNS} from finance.transactions where user_id = $1 and id = $2`,
          [userId, transactionId],
        );
        return r.rows[0] ? toTransaction(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async transactionsInRange(userId: string, fromIso: string, toIso: string): Promise<Transaction[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<TransactionRow>(
          `select ${TXN_COLUMNS} from finance.transactions
            where user_id = $1 and occurred_at between $2 and $3
            order by occurred_at desc`,
          [userId, fromIso, toIso],
        );
        return r.rows.map(toTransaction);
      },
      { as: 'user', userId },
    );
  }

  async hasAny(userId: string): Promise<boolean> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<{ exists: boolean }>(
          'select exists(select 1 from finance.transactions where user_id = $1) as exists',
          [userId],
        );
        return r.rows[0]?.exists ?? false;
      },
      { as: 'user', userId },
    );
  }
}
