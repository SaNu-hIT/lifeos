// Postgres-backed ReminderRepositoryPort. User-owned data — runs in USER context so
// wellness.reminders' RLS policy (0029_wellness_reminders.sql) is enforced.

import type { DatabasePort } from '@lifeos/api';
import type { Reminder, ReminderKind, ReminderRepositoryPort, ReminderStatus } from '@lifeos/skill-wellness';

interface ReminderRow {
  id: string;
  user_id: string;
  kind: ReminderKind;
  label: string;
  due_date: string;
  status: ReminderStatus;
  related_supply_item: string | null;
  created_at: string;
}

function toReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    label: row.label,
    dueDate: row.due_date,
    status: row.status,
    relatedSupplyItem: row.related_supply_item ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const REMINDER_COLUMNS = `id, user_id, kind, label, due_date, status, related_supply_item, created_at`;

export class PgWellnessReminderRepository implements ReminderRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async createReminder(reminder: Reminder): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into wellness.reminders
             (id, user_id, kind, label, due_date, status, related_supply_item, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           on conflict do nothing`,
          [
            reminder.id,
            reminder.userId,
            reminder.kind,
            reminder.label,
            reminder.dueDate,
            reminder.status,
            reminder.relatedSupplyItem ?? null,
            reminder.createdAt,
          ],
        );
      },
      { as: 'user', userId: reminder.userId },
    );
  }

  async findAutoReminder(userId: string, relatedSupplyItem: string, dueDate: string): Promise<Reminder | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ReminderRow>(
          `select ${REMINDER_COLUMNS} from wellness.reminders
            where user_id = $1 and kind = 'auto-supply' and related_supply_item = $2 and due_date = $3`,
          [userId, relatedSupplyItem, dueDate],
        );
        return r.rows[0] ? toReminder(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async listPending(userId: string): Promise<Reminder[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<ReminderRow>(
          `select ${REMINDER_COLUMNS} from wellness.reminders
            where user_id = $1 and status = 'pending'
            order by due_date asc`,
          [userId],
        );
        return r.rows.map(toReminder);
      },
      { as: 'user', userId },
    );
  }

  async markStatus(userId: string, reminderId: string, status: ReminderStatus): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('update wellness.reminders set status = $3 where user_id = $1 and id = $2', [
          userId,
          reminderId,
          status,
        ]);
      },
      { as: 'user', userId },
    );
  }
}
