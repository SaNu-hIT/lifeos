// Postgres-backed RecurringPaymentRepositoryPort. User-owned data — runs in USER
// context so finance.recurring_payments' RLS (0032) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type {
  RecurrenceInterval,
  RecurringPayment,
  RecurringPaymentRepositoryPort,
} from '@lifeos/skill-finance';

interface PaymentRow {
  id: string;
  user_id: string;
  label: string;
  amount_minor: string | number;
  currency: string;
  category_name: string;
  interval: RecurrenceInterval;
  next_due_date: string | Date;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/** node-pg returns `date` columns as a Date at LOCAL midnight; format local Y-M-D so
 *  the calendar day is preserved regardless of timezone. Tolerates a raw string too. */
function toDateOnly(v: string | Date): string {
  if (typeof v === 'string') return v.slice(0, 10);
  const y = v.getFullYear();
  const m = String(v.getMonth() + 1).padStart(2, '0');
  const d = String(v.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toPayment(row: PaymentRow): RecurringPayment {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    categoryName: row.category_name,
    interval: row.interval,
    nextDueDate: toDateOnly(row.next_due_date),
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const PAYMENT_COLUMNS =
  'id, user_id, label, amount_minor, currency, category_name, interval, next_due_date, active, created_at, updated_at';

export class PgFinanceRecurringPaymentRepository implements RecurringPaymentRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async addOrUpdate(payment: RecurringPayment): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into finance.recurring_payments
             (id, user_id, label, amount_minor, currency, category_name, interval,
              next_due_date, active, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (id)
           do update set label = excluded.label,
                          amount_minor = excluded.amount_minor,
                          currency = excluded.currency,
                          category_name = excluded.category_name,
                          interval = excluded.interval,
                          next_due_date = excluded.next_due_date,
                          active = excluded.active,
                          updated_at = excluded.updated_at`,
          [
            payment.id,
            payment.userId,
            payment.label,
            payment.amountMinor,
            payment.currency,
            payment.categoryName,
            payment.interval,
            payment.nextDueDate,
            payment.active,
            payment.createdAt,
            payment.updatedAt,
          ],
        );
      },
      { as: 'user', userId: payment.userId },
    );
  }

  async listActive(userId: string): Promise<RecurringPayment[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<PaymentRow>(
          `select ${PAYMENT_COLUMNS} from finance.recurring_payments
            where user_id = $1 and active = true
            order by next_due_date asc`,
          [userId],
        );
        return r.rows.map(toPayment);
      },
      { as: 'user', userId },
    );
  }

  async advanceNextDueDate(userId: string, paymentId: string, newDate: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          'update finance.recurring_payments set next_due_date = $3, updated_at = now() where user_id = $1 and id = $2',
          [userId, paymentId, newDate],
        );
      },
      { as: 'user', userId },
    );
  }
}
