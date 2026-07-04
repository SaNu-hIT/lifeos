import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import {
  createWellnessSkill,
  deriveCycles,
  predictNextCycle,
  dueSupplyReminders,
  type CycleDayEntry,
  type CycleEntryRepositoryPort,
  type Reminder,
  type ReminderRepositoryPort,
  type ReminderStatus,
  type SupplyItem,
  type WellnessProfile,
  type WellnessProfileRepositoryPort,
} from '../src/index.js';

// ── Test doubles ────────────────────────────────────────────────────────────
class InMemoryEntryRepo implements CycleEntryRepositoryPort {
  private entries = new Map<string, CycleDayEntry>();
  private key(userId: string, date: string): string {
    return `${userId}::${date}`;
  }
  async upsertEntry(entry: CycleDayEntry): Promise<void> {
    this.entries.set(this.key(entry.userId, entry.date), entry);
  }
  async deleteEntry(userId: string, date: string): Promise<void> {
    this.entries.delete(this.key(userId, date));
  }
  async entriesInRange(userId: string, fromDate: string, toDate: string): Promise<CycleDayEntry[]> {
    return [...this.entries.values()]
      .filter((e) => e.userId === userId && e.date >= fromDate && e.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async recentEntries(userId: string, limit: number): Promise<CycleDayEntry[]> {
    return [...this.entries.values()]
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }
}

class InMemoryProfileRepo implements WellnessProfileRepositoryPort {
  private profiles = new Map<string, WellnessProfile>();
  async getProfile(userId: string): Promise<WellnessProfile | undefined> {
    return this.profiles.get(userId);
  }
  async saveProfile(profile: WellnessProfile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }
}

class InMemoryReminderRepo implements ReminderRepositoryPort {
  private reminders = new Map<string, Reminder>();
  async createReminder(reminder: Reminder): Promise<void> {
    this.reminders.set(reminder.id, reminder);
  }
  async findAutoReminder(userId: string, relatedSupplyItem: string, dueDate: string): Promise<Reminder | undefined> {
    return [...this.reminders.values()].find(
      (r) => r.userId === userId && r.kind === 'auto-supply' && r.relatedSupplyItem === relatedSupplyItem && r.dueDate === dueDate,
    );
  }
  async listPending(userId: string): Promise<Reminder[]> {
    return [...this.reminders.values()].filter((r) => r.userId === userId && r.status === 'pending');
  }
  async markStatus(userId: string, reminderId: string, status: ReminderStatus): Promise<void> {
    const r = this.reminders.get(reminderId);
    if (r && r.userId === userId) this.reminders.set(reminderId, { ...r, status });
  }
}

function ctxFor(userId: string, nowIso = '2026-07-01T12:00:00.000Z'): UnifiedContext {
  return {
    user: { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['wellness.read', 'wellness.track'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'wellness',
    now: nowIso,
  };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

describe('@lifeos/skill-wellness', () => {
  function setup(clock = '2026-07-01T12:00:00.000Z') {
    const entries = new InMemoryEntryRepo();
    const profiles = new InMemoryProfileRepo();
    const reminders = new InMemoryReminderRepo();
    let seq = 0;
    const published: DomainEvent[] = [];
    const skill = createWellnessSkill({
      entries,
      profiles,
      reminders,
      newId: () => `id-${(seq += 1)}`,
      now: () => clock,
      publish: async (event) => {
        published.push(event);
      },
    });
    return { entries, profiles, reminders, skill, tools: skill.tools, published };
  }

  it('passes the skill contract kit', () => {
    const { skill } = setup();
    expect(() => runSkillContractTests(skill)).not.toThrow();
  });

  it('namespaces every tool and gates mutations behind the right capability', () => {
    const { tools } = setup();
    expect(tools.every((t) => t.name.startsWith('wellness.'))).toBe(true);
    expect(tool(tools, 'wellness.log_day').requiredCapability).toBe('wellness.track');
    expect(tool(tools, 'wellness.get_history_summary').requiredCapability).toBe('wellness.read');
    expect(tool(tools, 'wellness.delete_day').requiresConfirmation).toBe(true);
    expect(tool(tools, 'wellness.log_day').requiresConfirmation).toBe(false);
  });

  it('log_day is idempotent per date — logging the same date twice updates, not duplicates', async () => {
    const { tools, entries } = setup();
    const ctx = ctxFor('u1');
    await tool(tools, 'wellness.log_day').handler(ctx, { date: '2026-06-01', flow: 'light' });
    await tool(tools, 'wellness.log_day').handler(ctx, { date: '2026-06-01', flow: 'heavy', notes: 'corrected' });
    const rows = await entries.entriesInRange('u1', '2026-06-01', '2026-06-01');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.flow).toBe('heavy');
    expect(rows[0]!.notes).toBe('corrected');
  });

  it('deriveCycles groups consecutive flow days and computes length as the gap to the next start', () => {
    const mk = (date: string, flow: 'light' | 'heavy' | undefined = 'medium'): CycleDayEntry => ({
      id: date,
      userId: 'u1',
      date,
      flow,
      createdAt: '',
      updatedAt: '',
    });
    const entries = [
      mk('2026-05-01'), mk('2026-05-02'), mk('2026-05-03'),
      mk('2026-05-29'), mk('2026-05-30'), mk('2026-05-31'), mk('2026-06-01'),
      mk('2026-06-26'),
    ];
    const cycles = deriveCycles(entries);
    expect(cycles).toHaveLength(2);
    expect(cycles[0]).toEqual({ start: '2026-05-01', end: '2026-05-03', lengthDays: 28 });
    expect(cycles[1]).toEqual({ start: '2026-05-29', end: '2026-06-01', lengthDays: 28 });
  });

  it('predictNextCycle confidence scales with cycle count and falls back to profile average', () => {
    const noCycles = predictNextCycle([], '2026-07-01T00:00:00.000Z');
    expect(noCycles).toBeUndefined();

    const withFallback = predictNextCycle(
      [{ start: '2026-06-01', end: '2026-06-03', lengthDays: 28 }],
      '2026-07-01T00:00:00.000Z',
    );
    expect(withFallback?.confidence).toBe('low');
    expect(withFallback?.basedOnCycles).toBe(1);

    const threeCycles = [
      { start: '2026-04-01', end: '2026-04-03', lengthDays: 28 },
      { start: '2026-04-29', end: '2026-05-01', lengthDays: 28 },
      { start: '2026-05-27', end: '2026-05-29', lengthDays: 28 },
    ];
    const medium = predictNextCycle(threeCycles, '2026-06-01T00:00:00.000Z');
    expect(medium?.confidence).toBe('medium');
    expect(medium?.predictedNextStart).toBe('2026-06-24');

    const zeroCyclesNoFallback = predictNextCycle([], '2026-07-01T00:00:00.000Z', undefined);
    expect(zeroCyclesNoFallback).toBeUndefined();
  });

  it('dueSupplyReminders is due only within the lead-time window, not before or after', () => {
    const item: SupplyItem = { name: 'Pads', defaultReminderDaysBefore: 3 };
    const prediction = {
      predictedNextStart: '2026-07-10',
      averageCycleLengthDays: 28,
      averagePeriodLengthDays: 5,
      basedOnCycles: 3,
      confidence: 'medium' as const,
    };
    expect(dueSupplyReminders([item], prediction, '2026-07-05T00:00:00.000Z')).toHaveLength(0); // too early
    expect(dueSupplyReminders([item], prediction, '2026-07-08T00:00:00.000Z')).toHaveLength(1); // within window
    expect(dueSupplyReminders([item], prediction, '2026-07-11T00:00:00.000Z')).toHaveLength(0); // period started
  });

  it('list_reminders materializes an auto reminder exactly once across repeated calls', async () => {
    // Logged cycle 2026-05-01 -> 2026-05-29 (28 days) predicts next start 2026-06-26;
    // "now" of 2026-06-20 falls inside the 30-day supply lead time and before the
    // predicted start, so exactly one auto reminder should materialize.
    const { tools } = setup('2026-06-20T00:00:00.000Z');
    const ctx = ctxFor('u2', '2026-06-20T00:00:00.000Z');
    await tool(tools, 'wellness.log_day').handler(ctx, { date: '2026-05-01', flow: 'medium' });
    await tool(tools, 'wellness.log_day').handler(ctx, { date: '2026-05-29', flow: 'medium' });
    await tool(tools, 'wellness.save_profile').handler(ctx, {
      trackingGoals: ['cycle-prediction'],
      supplyList: [{ name: 'Pads', defaultReminderDaysBefore: 30 }],
    });

    const first = await tool(tools, 'wellness.list_reminders').handler(ctx, {});
    const second = await tool(tools, 'wellness.list_reminders').handler(ctx, {});
    expect(first.reminders.length).toBeGreaterThan(0);
    expect(second.reminders.length).toBe(first.reminders.length);
  });

  it('create_reminder + dismiss_reminder round-trip a manual reminder', async () => {
    const { tools, reminders } = setup();
    const ctx = ctxFor('u3');
    const { reminderId } = await tool(tools, 'wellness.create_reminder').handler(ctx, {
      label: 'Buy ibuprofen',
      dueDate: '2026-07-15',
    });
    expect((await reminders.listPending('u3')).map((r) => r.id)).toContain(reminderId);
    await tool(tools, 'wellness.dismiss_reminder').handler(ctx, { reminderId });
    expect((await reminders.listPending('u3')).map((r) => r.id)).not.toContain(reminderId);
  });

  it('get_history_summary signals onboarding state across fresh / profile-only / has-history', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u4');

    const fresh = await tool(tools, 'wellness.get_history_summary').handler(ctx, {});
    expect(fresh.hasAnyHistory).toBe(false);
    expect(fresh.hasProfile).toBe(false);

    await tool(tools, 'wellness.save_profile').handler(ctx, {
      trackingGoals: ['symptom-patterns'],
      supplyList: [],
    });
    const profileOnly = await tool(tools, 'wellness.get_history_summary').handler(ctx, {});
    expect(profileOnly.hasProfile).toBe(true);
    expect(profileOnly.hasAnyHistory).toBe(false);

    await tool(tools, 'wellness.log_day').handler(ctx, { date: '2026-06-01', flow: 'medium', symptoms: ['cramps'] });
    const withHistory = await tool(tools, 'wellness.get_history_summary').handler(ctx, {});
    expect(withHistory.hasAnyHistory).toBe(true);
    expect(withHistory.recentSymptomTags).toEqual([{ tag: 'cramps', count: 1 }]);
  });

  it('deletes a mistakenly logged day', async () => {
    const { tools, entries } = setup();
    const ctx = ctxFor('u5');
    await tool(tools, 'wellness.log_day').handler(ctx, { date: '2026-06-01', flow: 'light' });
    await tool(tools, 'wellness.delete_day').handler(ctx, { date: '2026-06-01' });
    expect(await entries.entriesInRange('u5', '2026-06-01', '2026-06-01')).toHaveLength(0);
  });
});
