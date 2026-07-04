import type { NutritionProfile } from '../domain/types.js';

export interface NutritionProfileRepositoryPort {
  getProfile(userId: string): Promise<NutritionProfile | undefined>;
  saveProfile(profile: NutritionProfile): Promise<void>;
}
