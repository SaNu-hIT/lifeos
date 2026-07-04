import type { HabitCheckIn } from '../domain/types.js';

export interface HabitCheckInRepositoryPort {
  /** Upsert by (userId, habitId, date) — checking the same day twice corrects it. */
  upsertCheckIn(entry: HabitCheckIn): Promise<void>;
  /** Check-ins for one habit, optionally only on/after `sinceDate`, oldest first. */
  checkInsForHabit(userId: string, habitId: string, sinceDate?: string): Promise<HabitCheckIn[]>;
  /** All of a user's check-ins on a single date (for "today's status" across habits). */
  checkInsForDate(userId: string, date: string): Promise<HabitCheckIn[]>;
}
