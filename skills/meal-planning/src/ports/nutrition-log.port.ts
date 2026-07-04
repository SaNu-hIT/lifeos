import type { NutritionLogEntry } from '../domain/types.js';

export interface NutritionLogRepositoryPort {
  addEntry(entry: NutritionLogEntry): Promise<void>;
  /** Entries with date in [fromDate, toDate], newest first. */
  entriesInRange(userId: string, fromDate: string, toDate: string): Promise<NutritionLogEntry[]>;
  /** True if the user has ever logged food (onboarding check). */
  hasAny(userId: string): Promise<boolean>;
}
