import type { Equipment, Exercise, MuscleGroup } from '../domain/types.js';

/** Read-only, platform-seeded reference data — not a third-party ProviderPort (no
 *  `health()`/`key`). Grounding data only: a miss here never blocks logging. */
export interface ExerciseCatalogPort {
  findByName(nameNormalized: string): Promise<Exercise | undefined>;
  search(query: string, limit?: number): Promise<Exercise[]>;
  list(filter?: { muscle?: MuscleGroup; equipment?: Equipment }): Promise<Exercise[]>;
}
