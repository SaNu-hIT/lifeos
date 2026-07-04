// Pure streak logic — no I/O, no hidden clock (docs/02 §8: caller passes `today`/
// `now`). Streaks are derived from raw check-ins the same way Wellness derives
// cycles from flow-logged days. Reminders are computed reactively (on tool call /
// context read) rather than via a scheduler — the platform has no cron (v1 limit).

import type {
  DueHabitReminder,
  Habit,
  HabitCheckIn,
  HabitFrequency,
  HabitStreak,
  TodayStatus,
} from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True if `date` is an expected occurrence for the given frequency. `weekly` treats
 *  every day as eligible (a once-a-week habit can be done on any day and still keep
 *  its streak by the 7-day rule below), so only `weekdays` filters here. */
function isExpectedDay(date: Date, frequency: HabitFrequency): boolean {
  if (frequency !== 'weekdays') return true;
  const dow = date.getUTCDay(); // 0 = Sun, 6 = Sat
  return dow !== 0 && dow !== 6;
}

/** Step one expected occurrence backward from `date` for the frequency. */
function prevExpected(date: Date, frequency: HabitFrequency): Date {
  if (frequency === 'weekly') return new Date(date.getTime() - 7 * DAY_MS);
  let d = new Date(date.getTime() - DAY_MS);
  if (frequency === 'weekdays') {
    while (!isExpectedDay(d, frequency)) d = new Date(d.getTime() - DAY_MS);
  }
  return d;
}

/**
 * Current and longest run of consecutive expected occurrences that were marked done,
 * walking backward from `today`. A gap on an expected day breaks the current streak.
 * Missing "today" itself does not break it (the day isn't over) — the streak simply
 * doesn't extend until today is done.
 */
export function computeStreak(
  checkIns: HabitCheckIn[],
  frequency: HabitFrequency,
  today: string,
): HabitStreak {
  const habitId = checkIns[0]?.habitId ?? '';
  const doneDays = new Set(checkIns.filter((c) => c.done).map((c) => c.date));
  const allDates = checkIns.map((c) => c.date).sort();
  const lastCheckedInDate = allDates[allDates.length - 1];

  const todayDate = toDate(today);

  // Current streak: start from today if done, else from the previous expected day.
  let cursor = doneDays.has(isoDay(todayDate)) ? todayDate : prevExpected(todayDate, frequency);
  let currentStreak = 0;
  // Bound the walk so a corrupt input can't loop forever (~10 years of daily).
  for (let guard = 0; guard < 4000; guard += 1) {
    if (!isExpectedDay(cursor, frequency)) {
      cursor = prevExpected(cursor, frequency);
      continue;
    }
    if (doneDays.has(isoDay(cursor))) {
      currentStreak += 1;
      cursor = prevExpected(cursor, frequency);
    } else {
      break;
    }
  }

  // Longest streak: scan every done day, counting consecutive expected runs.
  let longestStreak = 0;
  const sortedDone = [...doneDays].sort();
  for (const day of sortedDone) {
    const prev = isoDay(prevExpected(toDate(day), frequency));
    if (!doneDays.has(prev)) {
      // Run start — walk forward.
      let run = 0;
      let walk = toDate(day);
      while (doneDays.has(isoDay(walk))) {
        run += 1;
        // Next expected day forward.
        walk =
          frequency === 'weekly'
            ? new Date(walk.getTime() + 7 * DAY_MS)
            : nextExpected(walk, frequency);
      }
      longestStreak = Math.max(longestStreak, run);
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return { habitId, currentStreak, longestStreak, lastCheckedInDate };
}

function nextExpected(date: Date, frequency: HabitFrequency): Date {
  let d = new Date(date.getTime() + DAY_MS);
  if (frequency === 'weekdays') {
    while (!isExpectedDay(d, frequency)) d = new Date(d.getTime() + DAY_MS);
  }
  return d;
}

/** How today's check-in stands for a habit: done, explicitly not done, or pending. */
export function todayStatus(checkIns: HabitCheckIn[], today: string): TodayStatus {
  const todayIso = today.slice(0, 10);
  const entry = checkIns.find((c) => c.date === todayIso);
  if (!entry) return 'pending';
  return entry.done ? 'done' : 'not_done';
}

/** Active habits whose reminderTime has passed today but aren't yet checked in. */
export function dueReminders(
  habits: Habit[],
  checkInsByHabit: Map<string, HabitCheckIn[]>,
  now: string,
): DueHabitReminder[] {
  const todayIso = now.slice(0, 10);
  const nowHhmm = now.slice(11, 16);
  const todayDate = toDate(todayIso);
  const result: DueHabitReminder[] = [];
  for (const habit of habits) {
    if (!habit.active || !habit.reminderTime) continue;
    if (!isExpectedDay(todayDate, habit.frequency)) continue;
    if (nowHhmm < habit.reminderTime) continue;
    const status = todayStatus(checkInsByHabit.get(habit.id) ?? [], now);
    if (status === 'done') continue;
    result.push({ habitId: habit.id, habitName: habit.name, reminderTime: habit.reminderTime });
  }
  return result;
}
