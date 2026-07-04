import type { CycleDayEntry } from '../domain/types.js';

export interface CycleEntryRepositoryPort {
  /** Upsert by (userId, date) — logging the same day twice corrects it, not duplicates it. */
  upsertEntry(entry: CycleDayEntry): Promise<void>;
  deleteEntry(userId: string, date: string): Promise<void>;
  entriesInRange(userId: string, fromDate: string, toDate: string): Promise<CycleDayEntry[]>;
  recentEntries(userId: string, limit: number): Promise<CycleDayEntry[]>;
}
