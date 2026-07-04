import { describe, expect, it } from 'vitest';
import type { ContextRequest } from '@lifeos/contracts';
import { createWellnessContextProvider } from '../src/index.js';
import type { CycleEntryRepositoryPort } from '../src/ports/cycle-entry.port.js';
import type { WellnessProfileRepositoryPort } from '../src/ports/wellness-profile.port.js';
import type { ReminderRepositoryPort } from '../src/ports/reminder.port.js';
import type { CycleDayEntry, Reminder, ReminderStatus, WellnessProfile } from '../src/domain/types.js';

class FakeEntries implements CycleEntryRepositoryPort {
  constructor(private readonly entries: CycleDayEntry[]) {}
  async upsertEntry(): Promise<void> {}
  async deleteEntry(): Promise<void> {}
  async entriesInRange(userId: string): Promise<CycleDayEntry[]> {
    return this.entries.filter((e) => e.userId === userId);
  }
  async recentEntries(userId: string): Promise<CycleDayEntry[]> {
    return this.entries.filter((e) => e.userId === userId);
  }
}

class FakeProfiles implements WellnessProfileRepositoryPort {
  constructor(private readonly profile: WellnessProfile | undefined) {}
  async getProfile(userId: string): Promise<WellnessProfile | undefined> {
    return this.profile?.userId === userId ? this.profile : undefined;
  }
  async saveProfile(): Promise<void> {}
}

class FakeReminders implements ReminderRepositoryPort {
  constructor(private readonly pending: Reminder[] = []) {}
  async createReminder(): Promise<void> {}
  async findAutoReminder(): Promise<Reminder | undefined> {
    return undefined;
  }
  async listPending(userId: string): Promise<Reminder[]> {
    return this.pending.filter((r) => r.userId === userId);
  }
  async markStatus(): Promise<void> {}
}

const request: ContextRequest = { userId: 'u1', conversationId: 'c1', scope: 'wellness' };

describe('wellness — context provider', () => {
  it('flags onboardingIncomplete when there is no profile and no history', async () => {
    const provider = createWellnessContextProvider({
      entries: new FakeEntries([]),
      profiles: new FakeProfiles(undefined),
      reminders: new FakeReminders(),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const wellness = (partial.settings as { wellness: Record<string, unknown> }).wellness;
    expect(wellness.onboardingIncomplete).toBe(true);
    expect(wellness.hasAnyHistory).toBe(false);
    expect(wellness.daysUntilPredictedPeriod).toBeNull();
  });

  it('is not onboarding-incomplete once a profile exists, even with no history yet', async () => {
    const profile: WellnessProfile = {
      userId: 'u1',
      trackingGoals: ['cycle-prediction'],
      supplyList: [],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    const provider = createWellnessContextProvider({
      entries: new FakeEntries([]),
      profiles: new FakeProfiles(profile),
      reminders: new FakeReminders(),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const wellness = (partial.settings as { wellness: Record<string, unknown> }).wellness;
    expect(wellness.onboardingIncomplete).toBe(false);
  });

  it('computes daysUntilPredictedPeriod from a profile-supplied average cycle length', async () => {
    const profile: WellnessProfile = {
      userId: 'u1',
      trackingGoals: ['cycle-prediction'],
      averageCycleLengthDays: 28,
      supplyList: [],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    };
    const entries: CycleDayEntry[] = [
      { id: '1', userId: 'u1', date: '2026-06-01', flow: 'medium', createdAt: '', updatedAt: '' },
    ];
    const provider = createWellnessContextProvider({
      entries: new FakeEntries(entries),
      profiles: new FakeProfiles(profile),
      reminders: new FakeReminders(),
      now: () => '2026-06-25T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const wellness = (partial.settings as { wellness: Record<string, unknown> }).wellness;
    expect(wellness.hasAnyHistory).toBe(true);
    expect(wellness.daysUntilPredictedPeriod).toBe(4); // 2026-06-01 + 28 = 2026-06-29, minus now (06-25) = 4
  });

  it('counts pending reminders (stored + live-computed due) into pendingReminderCount', async () => {
    const pending: Reminder[] = [
      {
        id: 'r1',
        userId: 'u1',
        kind: 'manual' as const,
        label: 'Buy ibuprofen',
        dueDate: '2026-07-10',
        status: 'pending' as ReminderStatus,
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ];
    const provider = createWellnessContextProvider({
      entries: new FakeEntries([]),
      profiles: new FakeProfiles(undefined),
      reminders: new FakeReminders(pending),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    const partial = await provider.contribute(request);
    const wellness = (partial.settings as { wellness: Record<string, unknown> }).wellness;
    expect(wellness.pendingReminderCount).toBe(1);
  });

  it('is scoped to wellness', () => {
    const provider = createWellnessContextProvider({
      entries: new FakeEntries([]),
      profiles: new FakeProfiles(undefined),
      reminders: new FakeReminders(),
      now: () => '2026-07-04T00:00:00.000Z',
    });
    expect(provider.scope).toBe('wellness');
  });
});
