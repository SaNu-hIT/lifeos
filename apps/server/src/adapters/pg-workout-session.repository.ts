// Postgres-backed WorkoutSessionRepositoryPort. User-owned data — runs in USER
// context so workout.sessions' RLS policy (0022_workout_sessions.sql) is enforced,
// same pattern as PgGroceryListRepository. The "one active session" invariant is
// primarily enforced by workout.start_session checking getActiveSession first; the
// partial unique index in the schema is the storage-level backstop.

import type { DatabasePort } from '@lifeos/api';
import type { SessionStatus, WorkoutSession, WorkoutSessionRepositoryPort } from '@lifeos/skill-workout';

interface SessionRow {
  id: string;
  user_id: string;
  status: SessionStatus;
  title: string | null;
  notes: string | null;
  started_at: string;
  finished_at: string | null;
}

function toSession(row: SessionRow): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    title: row.title ?? undefined,
    notes: row.notes ?? undefined,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : undefined,
  };
}

export class PgWorkoutSessionRepository implements WorkoutSessionRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async createSession(session: WorkoutSession): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `insert into workout.sessions (id, user_id, status, title, notes, started_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [session.id, session.userId, session.status, session.title ?? null, session.notes ?? null, session.startedAt],
        );
      },
      { as: 'user', userId: session.userId },
    );
  }

  async getActiveSession(userId: string): Promise<WorkoutSession | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SessionRow>(
          `select id, user_id, status, title, notes, started_at, finished_at
             from workout.sessions
            where user_id = $1 and status = 'active'`,
          [userId],
        );
        return r.rows[0] ? toSession(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async getSession(userId: string, sessionId: string): Promise<WorkoutSession | undefined> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SessionRow>(
          `select id, user_id, status, title, notes, started_at, finished_at
             from workout.sessions
            where user_id = $1 and id = $2`,
          [userId, sessionId],
        );
        return r.rows[0] ? toSession(r.rows[0]) : undefined;
      },
      { as: 'user', userId },
    );
  }

  async finishSession(
    userId: string,
    sessionId: string,
    patch: { finishedAt: string; title?: string; notes?: string; status: SessionStatus },
  ): Promise<void> {
    await this.db.transaction(
      async (tx) => {
        await tx.query(
          `update workout.sessions
              set status = $3, finished_at = $4,
                  title = coalesce($5, title),
                  notes = coalesce($6, notes)
            where user_id = $1 and id = $2`,
          [userId, sessionId, patch.status, patch.finishedAt, patch.title ?? null, patch.notes ?? null],
        );
      },
      { as: 'user', userId },
    );
  }

  async recentSessions(userId: string, limit: number): Promise<WorkoutSession[]> {
    return this.db.transaction(
      async (tx) => {
        const r = await tx.query<SessionRow>(
          `select id, user_id, status, title, notes, started_at, finished_at
             from workout.sessions
            where user_id = $1 and status = 'finished'
            order by finished_at desc
            limit $2`,
          [userId, limit],
        );
        return r.rows.map(toSession);
      },
      { as: 'user', userId },
    );
  }
}
