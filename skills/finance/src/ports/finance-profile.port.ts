import type { FinanceProfile } from '../domain/types.js';

export interface FinanceProfileRepositoryPort {
  getProfile(userId: string): Promise<FinanceProfile | undefined>;
  saveProfile(profile: FinanceProfile): Promise<void>;
}
