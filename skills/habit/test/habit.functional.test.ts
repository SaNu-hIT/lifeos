// End-to-end functional test: drives the real Habit tool handlers through in-memory
// repositories, proving the check-in → streak → summary flow works as a user would.

import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import {
  createHabitSkill,
  type Habit,
  type HabitCheckIn,
  type HabitCheckInRepositoryPort,
  type HabitRepositoryPort,
  type HabitSummary,
  type HabitWithProgress,
} from '../src/index.js';

class InMemoryHabits implements HabitRepositoryPort {
  private rows = new Map<string, Habit>();
  async createHabit(h: Habit): Promise<void> {
    this.rows.set(h.id, h);
  }
  async updateHabit(
    userId: string,
    id: string,
    patch: Partial<Pick<Habit, 'name' | 'frequency' | 'reminderTime' | 'active'>>,
  ): Promise<Habit | undefined> {
    const h = this.rows.get(id);
    if (!h || h.userId !== userId) return undefined;
    const updated = { ...h, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    this.rows.set(id, updated);
    return updated;
  }
  async deleteHabit(userId: string, id: string): Promise<void> {
    const h = this.rows.get(id);
    if (h && h.userId === userId) this.rows.delete(id);
  }
  async listHabits(userId: string, opts?: { activeOnly?: boolean }): Promise<Habit[]> {
    return [...this.rows.values()]
      .filter((h) => h.userId === userId && (!opts?.activeOnly || h.active))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async getHabit(userId: string, id: string): Promise<Habit | undefined> {
    const h = this.rows.get(id);
    return h && h.userId === userId ? h : undefined;
  }
}

class InMemoryCheckIns implements HabitCheckInRepositoryPort {
  private rows: HabitCheckIn[] = [];
  async upsertCheckIn(e: HabitCheckIn): Promise<void> {
    this.rows = this.rows.filter((r) => !(r.habitId === e.habitId && r.date === e.date));
    this.rows.push(e);
  }
  async checkInsForHabit(userId: string, habitId: string, sinceDate?: string): Promise<HabitCheckIn[]> {
    return this.rows
      .filter((r) => r.userId === userId && r.habitId === habitId && (!sinceDate || r.date >= sinceDate))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  async checkInsForDate(userId: string, date: string): Promise<HabitCheckIn[]> {
    return this.rows.filter((r) => r.userId === userId && r.date === date);
  }
}

function ctxFor(userId: string, nowIso = '2026-07-04T20:00:00.000Z'): UnifiedContext {
  return {
    user: { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['habit.read', 'habit.track'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'habit',
    now: nowIso,
  };
}

function build(nowIso = '2026-07-04T20:00:00.000Z') {
  const events: DomainEvent[] = [];
  let seq = 0;
  const manifest = createHabitSkill({
    habits: new InMemoryHabits(),
    checkIns: new InMemoryCheckIns(),
    newId: () => `id-${++seq}`,
    now: () => nowIso,
    publish: async (e) => {
      events.push(e);
    },
  });
  return { manifest, events };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

describe('@lifeos/skill-habit (functional)', () => {
  it('passes the skill contract', () => {
    runSkillContractTests(build().manifest);
  });

  it('creates a habit, checks in, and reports the streak in the summary', async () => {
    const { manifest, events } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u1');

    const { habitId } = (await tool(tools, 'habit.create_habit').handler(ctx, {
      name: 'Meditate',
      frequency: 'daily',
    })) as { habitId: string };

    // Backfill three consecutive days ending today.
    for (const date of ['2026-07-02', '2026-07-03', '2026-07-04']) {
      await tool(tools, 'habit.check_in').handler(ctx, { habitId, date });
    }

    const listed = (await tool(tools, 'habit.list_habits').handler(ctx, {})) as { habits: HabitWithProgress[] };
    expect(listed.habits[0]!.streak.currentStreak).toBe(3);
    expect(listed.habits[0]!.todayStatus).toBe('done');

    const summary = (await tool(tools, 'habit.get_summary').handler(ctx, {})) as HabitSummary;
    expect(summary.hasAnyHistory).toBe(true);
    expect(summary.habits[0]!.streak.currentStreak).toBe(3);
    expect(events.some((e) => e.type === 'habit.checked_in')).toBe(true);
  });

  it('reports a due reminder when past reminderTime and not yet checked in', async () => {
    const { manifest } = build('2026-07-04T19:00:00.000Z');
    const tools = manifest.tools;
    const ctx = ctxFor('u2', '2026-07-04T19:00:00.000Z');

    await tool(tools, 'habit.create_habit').handler(ctx, {
      name: 'Evening walk',
      frequency: 'daily',
      reminderTime: '18:00',
    });

    const summary = (await tool(tools, 'habit.get_summary').handler(ctx, {})) as HabitSummary;
    expect(summary.dueReminders.map((r) => r.habitName)).toContain('Evening walk');
  });

  it('check_in is idempotent per day (correcting, not duplicating)', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u3');

    const { habitId } = (await tool(tools, 'habit.create_habit').handler(ctx, {
      name: 'Read',
      frequency: 'daily',
    })) as { habitId: string };

    const first = (await tool(tools, 'habit.check_in').handler(ctx, { habitId, date: '2026-07-04' })) as {
      alreadyDone: boolean;
    };
    const second = (await tool(tools, 'habit.check_in').handler(ctx, { habitId, date: '2026-07-04' })) as {
      streak: number;
      alreadyDone: boolean;
    };
    expect(first.alreadyDone).toBe(false);
    expect(second.alreadyDone).toBe(true);
    expect(second.streak).toBe(1); // not 2 — same day corrected, not duplicated
  });

  it('deletes a habit so it no longer appears', async () => {
    const { manifest } = build();
    const tools = manifest.tools;
    const ctx = ctxFor('u4');

    const { habitId } = (await tool(tools, 'habit.create_habit').handler(ctx, {
      name: 'Floss',
      frequency: 'daily',
    })) as { habitId: string };
    await tool(tools, 'habit.delete_habit').handler(ctx, { habitId });

    const listed = (await tool(tools, 'habit.list_habits').handler(ctx, {})) as { habits: HabitWithProgress[] };
    expect(listed.habits).toHaveLength(0);
  });
});
