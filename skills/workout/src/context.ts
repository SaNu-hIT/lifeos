// Workout's Context Provider — a light existence/recency check only (cheap on every
// turn). The heavy structured history lives behind the workout.get_history_summary
// tool call, not here, so context assembly stays fast even for long-time users.

import type { ContextProvider, ContextRequest, UnifiedContext } from '@lifeos/contracts';
import { daysSince } from './domain/recency.js';
import type { WorkoutSessionRepositoryPort } from './ports/workout-session.port.js';
import type { WorkoutProfileRepositoryPort } from './ports/workout-profile.port.js';

export interface WorkoutContextDeps {
  sessions: WorkoutSessionRepositoryPort;
  profiles: WorkoutProfileRepositoryPort;
  now: () => string;
}

export function createWorkoutContextProvider(deps: WorkoutContextDeps): ContextProvider {
  return {
    scope: 'workout',
    async contribute(request: ContextRequest): Promise<Partial<UnifiedContext>> {
      const nowIso = deps.now();
      const [active, recent, profile] = await Promise.all([
        deps.sessions.getActiveSession(request.userId),
        deps.sessions.recentSessions(request.userId, 1),
        deps.profiles.getProfile(request.userId),
      ]);
      const last = recent[0];
      const hasAnyHistory = recent.length > 0;

      return {
        settings: {
          workout: {
            hasActiveSession: active != null,
            activeSessionId: active?.id,
            onboardingIncomplete: !profile && !hasAnyHistory,
            hasAnyHistory,
            daysSinceLastWorkout: last?.finishedAt ? daysSince(last.finishedAt, nowIso) : null,
            lastSessionTitle: last?.title,
          },
        },
      };
    },
  };
}
