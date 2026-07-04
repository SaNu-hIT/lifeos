import type { Reminder, ReminderStatus } from '../domain/types.js';

export interface ReminderRepositoryPort {
  createReminder(reminder: Reminder): Promise<void>;
  /** Existing row for a given auto-supply reminder, if one was already materialized —
   *  used to avoid creating duplicate rows on every read (see tools.ts list_reminders). */
  findAutoReminder(userId: string, relatedSupplyItem: string, dueDate: string): Promise<Reminder | undefined>;
  listPending(userId: string): Promise<Reminder[]>;
  markStatus(userId: string, reminderId: string, status: ReminderStatus): Promise<void>;
}
