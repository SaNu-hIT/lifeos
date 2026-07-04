import type { FoodItem } from '../domain/types.js';

/** Read-only, platform-seeded reference data — not a third-party ProviderPort (no
 *  `health()`/`key`). Grounding data only: a miss here never blocks planning/logging. */
export interface FoodCatalogPort {
  findByName(nameNormalized: string): Promise<FoodItem | undefined>;
  search(query: string, limit?: number): Promise<FoodItem[]>;
  list(): Promise<FoodItem[]>;
}
