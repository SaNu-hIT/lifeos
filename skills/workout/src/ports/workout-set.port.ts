import type { MuscleGroup, SetEntry } from '../domain/types.js';

export interface WorkoutSetRepositoryPort {
  addSet(set: SetEntry): Promise<void>;
  updateSet(
    userId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'rpe' | 'notes'>>,
  ): Promise<SetEntry | undefined>;
  deleteSet(userId: string, setId: string): Promise<void>;
  getSet(userId: string, setId: string): Promise<SetEntry | undefined>;
  setsForSession(userId: string, sessionId: string): Promise<SetEntry[]>;
  recentSetsForExercise(userId: string, exerciseNameNormalized: string, limit: number): Promise<SetEntry[]>;
  /** Last-performed timestamp per muscle group, joined via matched catalog exercises;
   *  freeform sets with no catalog match don't contribute (documented gap). */
  lastPerformedByMuscle(userId: string, muscles: MuscleGroup[]): Promise<Partial<Record<MuscleGroup, string>>>;
}
