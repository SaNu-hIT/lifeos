// Postgres-backed HabitCheckInRepositoryPort. User-owned data — runs in USER context
// so habit.check_ins' RLS (0040) is enforced. Upsert by (habit_id, entry_date).

import type { DatabasePort } from '@lifeos/api';
import type { HabitCheckIn, HabitCheckInRepositoryPort } from '@lifeos/skill-habit';

interface CheckInRow {
  id: string;
  user_id: string;
  habit_id: string;
  entry_date: string | Date;
  done: boolean;
  notes: string | null;
  created_at: string;
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

function toCheckIn(row: CheckInRow): HabitCheckIn {
  return {
    id: row.id,
    userId: row.user_id,
    habitId: row.habit_id,
    date: toDateOnly(row.entry_date),
    done: row.done,
    notes: row.notes ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const CHECKIN_COLUMNS = 'id, user_id, habit_id, entry_date, done, notes, created_at';

export class PgHabitCheckInRepository implements HabitCheckInRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async upsertCheckIn(entry: HabitCheckIn): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into habit.check_ins (id, user_id, habit_id, entry_date, done, notes, created_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (habit_id, entry_date)
           do update set done = excluded.done,
                          notes = excluded.notes`,
          [entry.id, entry.userId, entry.habitId, entry.date, entry.done, entry.notes ?? null, entry.createdAt],
        );
      },
      { as: 'user', userId: entry.userId },
    );
  }

  async checkInsForHabit(userId: string, habitId: string, sinceDate?: string): Promise<HabitCheckIn[]> {
    return this.db.transaction(
      async (tx) => {
        const r = sinceDate
          ? await tx.query<CheckInRow>(
              `select ${CHECKIN_COLUMNS} from habit.check_ins
                where user_id = $1 and habit_id = $2 and entry_date >= $3
                order by entry_date asc`,
              [userId, habitId, sinceDate],
            )
          : await tx.query<CheckInRow>(
              `select ${CHECKIN_COLUMNS} from habit.check_ins
                where user_id = $1 and habit_id = $2
                order by entry_date asc`,
              [userId, habitId],
            );
        return r.rows.map(toCheckIn);
      },
      { as: 'user', userId },
    );
  }

  async checkInsForDate(userId: string, date: string): Promise<HabitCheckIn[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<CheckInRow>(
          `select ${CHECKIN_COLUMNS} from habit.check_ins where user_id = $1 and entry_date = $2`,
          [userId, date],
        );
        return r.rows.map(toCheckIn);
      },
      { as: 'user', userId },
    );
  }
}
