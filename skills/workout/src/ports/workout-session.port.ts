import type { SessionStatus, WorkoutSession } from '../domain/types.js';

export interface WorkoutSessionRepositoryPort {
  createSession(session: WorkoutSession): Promise<void>;
  /** At most one active session per user (enforced by storage — see 0022 migration). */
  getActiveSession(userId: string): Promise<WorkoutSession | undefined>;
  getSession(userId: string, sessionId: string): Promise<WorkoutSession | undefined>;
  finishSession(
    userId: string,
    sessionId: string,
    patch: { finishedAt: string; title?: string; notes?: string; status: SessionStatus },
  ): Promise<void>;
  recentSessions(userId: string, limit: number): Promise<WorkoutSession[]>;
}
