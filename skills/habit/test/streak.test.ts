import { describe, expect, it } from 'vitest';
import { computeStreak, dueReminders, todayStatus } from '../src/index.js';
import type { Habit, HabitCheckIn } from '../src/index.js';

function checkIn(date: string, done = true): HabitCheckIn {
  return { id: date, userId: 'u1', habitId: 'h1', date, done, createdAt: `${date}T08:00:00Z` };
}

describe('computeStreak (daily)', () => {
  it('counts consecutive done days ending today', () => {
    const entries = ['2026-07-02', '2026-07-03', '2026-07-04'].map((d) => checkIn(d));
    const s = computeStreak(entries, 'daily', '2026-07-04T20:00:00Z');
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.lastCheckedInDate).toBe('2026-07-04');
  });

  it('does not break the current streak when today is not yet done', () => {
    const entries = ['2026-07-02', '2026-07-03'].map((d) => checkIn(d));
    const s = computeStreak(entries, 'daily', '2026-07-04T09:00:00Z');
    expect(s.currentStreak).toBe(2);
  });

  it('breaks the streak on a missed day', () => {
    const entries = [checkIn('2026-07-01'), checkIn('2026-07-04')];
    const s = computeStreak(entries, 'daily', '2026-07-04T20:00:00Z');
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(1);
  });

  it('ignores days explicitly marked not done', () => {
    const entries = [checkIn('2026-07-03', true), checkIn('2026-07-04', false)];
    const s = computeStreak(entries, 'daily', '2026-07-04T20:00:00Z');
    // today is not done, so walk from prev expected day (07-03) which is done → 1
    expect(s.currentStreak).toBe(1);
  });
});

describe('computeStreak (weekdays)', () => {
  it('skips weekends when counting consecutive expected days', () => {
    // Fri 2026-07-03 and Mon 2026-07-06 are consecutive weekday occurrences.
    const entries = [checkIn('2026-07-03'), checkIn('2026-07-06')];
    const s = computeStreak(entries, 'weekdays', '2026-07-06T20:00:00Z');
    expect(s.currentStreak).toBe(2);
  });
});

describe('computeStreak (weekly)', () => {
  it('counts occurrences 7 days apart', () => {
    const entries = [checkIn('2026-06-20'), checkIn('2026-06-27'), checkIn('2026-07-04')];
    const s = computeStreak(entries, 'weekly', '2026-07-04T20:00:00Z');
    expect(s.currentStreak).toBe(3);
  });
});

describe('todayStatus', () => {
  it('reports done / not_done / pending', () => {
    expect(todayStatus([checkIn('2026-07-04', true)], '2026-07-04T20:00:00Z')).toBe('done');
    expect(todayStatus([checkIn('2026-07-04', false)], '2026-07-04T20:00:00Z')).toBe('not_done');
    expect(todayStatus([], '2026-07-04T20:00:00Z')).toBe('pending');
  });
});

describe('dueReminders', () => {
  const habit: Habit = {
    id: 'h1',
    userId: 'u1',
    name: 'Meditate',
    frequency: 'daily',
    reminderTime: '18:00',
    active: true,
    createdAt: '',
    updatedAt: '',
  };

  it('is due after reminderTime when not checked in', () => {
    const due = dueReminders([habit], new Map(), '2026-07-04T19:00:00Z');
    expect(due).toHaveLength(1);
    expect(due[0]!.habitName).toBe('Meditate');
  });

  it('is not due before reminderTime', () => {
    expect(dueReminders([habit], new Map(), '2026-07-04T17:00:00Z')).toHaveLength(0);
  });

  it('is not due once checked in', () => {
    const map = new Map([['h1', [checkIn('2026-07-04', true)]]]);
    expect(dueReminders([habit], map, '2026-07-04T19:00:00Z')).toHaveLength(0);
  });
});
