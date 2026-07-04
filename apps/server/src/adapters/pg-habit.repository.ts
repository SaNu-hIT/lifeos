// Postgres-backed HabitRepositoryPort. User-owned data — runs in USER context so
// habit.habits' RLS (0039) is enforced. deleteHabit hard-deletes; check-ins cascade.

import type { DatabasePort } from '@lifeos/api';
import type { Habit, HabitFrequency, HabitRepositoryPort } from '@lifeos/skill-habit';

interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  frequency: HabitFrequency;
  reminder_time: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    frequency: row.frequency,
    // Postgres `time` returns "HH:MM:SS" — trim to "HH:MM" for the domain model.
    reminderTime: row.reminder_time ? row.reminder_time.slice(0, 5) : undefined,
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const HABIT_COLUMNS = 'id, user_id, name, frequency, reminder_time, active, created_at, updated_at';

export class PgHabitRepository implements HabitRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async createHabit(habit: Habit): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into habit.habits
             (id, user_id, name, frequency, reminder_time, active, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            habit.id,
            habit.userId,
            habit.name,
            habit.frequency,
            habit.reminderTime ?? null,
            habit.active,
            habit.createdAt,
            habit.updatedAt,
          ],
        );
      },
      { as: 'user', userId: habit.userId },
    );
  }

  async updateHabit(
    userId: string,
    habitId: string,
    patch: Partial<Pick<Habit, 'name' | 'frequency' | 'reminderTime' | 'active'>>,
  ): Promise<Habit | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<HabitRow>(
          `update habit.habits set
             name = coalesce($3, name),
             frequency = coalesce($4, frequency),
             reminder_time = coalesce($5, reminder_time),
             active = coalesce($6, active),
             updated_at = now()
           where user_id = $1 and id = $2
           returning ${HABIT_COLUMNS}`,
          [
            userId,
            habitId,
            patch.name ?? null,
            patch.frequency ?? null,
            patch.reminderTime ?? null,
            patch.active ?? null,
          ],
        );
        return r.rows[0] ? toHabit(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async deleteHabit(userId: string, habitId: string): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query('delete from habit.habits where user_id = $1 and id = $2', [userId, habitId]);
      },
      { as: 'user', userId },
    );
  }

  async listHabits(userId: string, opts?: { activeOnly?: boolean }): Promise<Habit[]> {
    return this.db.transaction(
      async (tx) => {
        const where = opts?.activeOnly ? 'where user_id = $1 and active = true' : 'where user_id = $1';
        const r = await tx.query<HabitRow>(
          `select ${HABIT_COLUMNS} from habit.habits ${where} order by created_at asc`,
          [userId],
        );
        return r.rows.map(toHabit);
      },
      { as: 'user', userId },
    );
  }

  async getHabit(userId: string, habitId: string): Promise<Habit | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<HabitRow>(
          `select ${HABIT_COLUMNS} from habit.habits where user_id = $1 and id = $2`,
          [userId, habitId],
        );
        return r.rows[0] ? toHabit(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }
}
