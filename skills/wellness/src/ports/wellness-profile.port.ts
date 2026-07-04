import type { WellnessProfile } from '../domain/types.js';

export interface WellnessProfileRepositoryPort {
  getProfile(userId: string): Promise<WellnessProfile | undefined>;
  saveProfile(profile: WellnessProfile): Promise<void>;
}
