import type { Habit } from '../domain/types.js';

export interface HabitRepositoryPort {
  createHabit(habit: Habit): Promise<void>;
  updateHabit(
    userId: string,
    habitId: string,
    patch: Partial<Pick<Habit, 'name' | 'frequency' | 'reminderTime' | 'active'>>,
  ): Promise<Habit | undefined>;
  /** Soft-delete: caller sets active=false, or hard-delete cascading check-ins. */
  deleteHabit(userId: string, habitId: string): Promise<void>;
  listHabits(userId: string, opts?: { activeOnly?: boolean }): Promise<Habit[]>;
  getHabit(userId: string, habitId: string): Promise<Habit | undefined>;
}
