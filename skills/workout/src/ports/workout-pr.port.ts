import type { PersonalRecord } from '../domain/types.js';

export interface WorkoutPrRepositoryPort {
  getPr(userId: string, exerciseNameNormalized: string): Promise<PersonalRecord | undefined>;
  upsertPr(record: PersonalRecord): Promise<void>;
  listPrs(userId: string): Promise<PersonalRecord[]>;
}
