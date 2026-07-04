import type { WorkoutProfile } from '../domain/types.js';

export interface WorkoutProfileRepositoryPort {
  getProfile(userId: string): Promise<WorkoutProfile | undefined>;
  saveProfile(profile: WorkoutProfile): Promise<void>;
}
