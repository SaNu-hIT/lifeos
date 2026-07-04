import { describe, expect, it } from 'vitest';
import type { ContextRequest } from '@lifeos/contracts';
import { createWorkoutContextProvider } from '../src/index.js';
import type { WorkoutSessionRepositoryPort } from '../src/ports/workout-session.port.js';
import type { WorkoutProfileRepositoryPort } from '../src/ports/workout-profile.port.js';
import type { SessionStatus, WorkoutProfile, WorkoutSession } from '../src/domain/types.js';

class FakeSessions implements WorkoutSessionRepositoryPort {
  constructor(
    private readonly active: WorkoutSession | undefined,
    private readonly finished: WorkoutSession[],
  ) {}
  async createSession(): Promise<void> {}
  async getActiveSession(userId: string): Promise<WorkoutSession | undefined> {
    return this.active?.userId === userId ? this.active : undefined;
  }
  async getSession(): Promise<WorkoutSession | undefined> {
    return undefined;
  }
  async finishSession(): Promise<void> {}
  async recentSessions(userId: string, limit: number): Promise<WorkoutSession[]> {
    return this.finished.filter((s) => s.userId === userId).slice(0, limit);
  }
}

class FakeProfiles implements WorkoutProfileRepositoryPort {
  constructor(private readonly profile: WorkoutProfile | undefined) {}
  async getProfile(userId: string): Promise<WorkoutProfile | undefined> {
    return this.profile?.userId === userId ? this.profile : undefined;
  }
  async saveProfile(): Promise<void> {}
}

const request: ContextRequest = { userId: 'u1', conversationId: 'c1', scope: 'workout' };

describe('workout — context provider', () => {
  it('flags onboardingIncomplete when there is no profile and no history', async () => {
    const provider = createWorkoutContextProvider({
      sessions: new FakeSessions(undefined, []),
      profiles: new FakeProfiles(undefined),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const workout = (partial.settings as { workout: Record<string, unknown> }).workout;
    expect(workout.onboardingIncomplete).toBe(true);
    expect(workout.hasAnyHistory).toBe(false);
    expect(workout.daysSinceLastWorkout).toBeNull();
  });

  it('is not onboarding-incomplete once a profile exists, even with no history yet', async () => {
    const profile: WorkoutProfile = {
      userId: 'u1',
      frequencyPerWeek: 3,
      goals: ['strength'],
      experience: 'beginner',
      availableEquipment: ['barbell'],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    const provider = createWorkoutContextProvider({
      sessions: new FakeSessions(undefined, []),
      profiles: new FakeProfiles(profile),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const workout = (partial.settings as { workout: Record<string, unknown> }).workout;
    expect(workout.onboardingIncomplete).toBe(false);
  });

  it('reports hasActiveSession + activeSessionId when a session is in progress', async () => {
    const active: WorkoutSession = {
      id: 's1',
      userId: 'u1',
      status: 'active' as SessionStatus,
      startedAt: '2026-07-04T00:00:00.000Z',
    };
    const provider = createWorkoutContextProvider({
      sessions: new FakeSessions(active, []),
      profiles: new FakeProfiles(undefined),
      now: () => '2026-07-04T01:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const workout = (partial.settings as { workout: Record<string, unknown> }).workout;
    expect(workout.hasActiveSession).toBe(true);
    expect(workout.activeSessionId).toBe('s1');
  });

  it('computes daysSinceLastWorkout from the last finished session', async () => {
    const finished: WorkoutSession = {
      id: 's0',
      userId: 'u1',
      status: 'finished' as SessionStatus,
      startedAt: '2026-06-28T00:00:00.000Z',
      finishedAt: '2026-06-28T01:00:00.000Z',
      title: 'Push Day',
    };
    const provider = createWorkoutContextProvider({
      sessions: new FakeSessions(undefined, [finished]),
      profiles: new FakeProfiles(undefined),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const workout = (partial.settings as { workout: Record<string, unknown> }).workout;
    expect(workout.daysSinceLastWorkout).toBe(5);
    expect(workout.lastSessionTitle).toBe('Push Day');
    expect(workout.hasAnyHistory).toBe(true);
  });

  it('is scoped to workout', () => {
    const provider = createWorkoutContextProvider({
      sessions: new FakeSessions(undefined, []),
      profiles: new FakeProfiles(undefined),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    expect(provider.scope).toBe('workout');
  });
});
