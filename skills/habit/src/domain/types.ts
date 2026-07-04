// Habit's domain model. Pure first-party persistence — no external connector.
// A check-in is one row per (habit, date), an idempotent upsert: checking the same
// day twice corrects it rather than duplicating (same simplicity Wellness gets from
// "one cycle-day at a time"). Streaks are derived at read time from check-ins, not
// stored — mirroring how Wellness derives cycles from flow-logged days.

export type HabitFrequency = 'daily' | 'weekdays' | 'weekly';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  frequency: HabitFrequency;
  /** Optional local reminder time, "HH:MM" 24h. Used for reactive due-reminders. */
  reminderTime?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCheckIn {
  id: string;
  userId: string;
  habitId: string;
  /** ISO date (yyyy-mm-dd) — one entry per habit per date (idempotent upsert). */
  date: string;
  done: boolean;
  notes?: string;
  createdAt: string;
}

export interface HabitStreak {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckedInDate?: string;
}

// ── Shapes fed to the LLM for AI-composed nudges/insights ───────────────────────
// DATA only — the Skill never authors motivational copy itself (same contract as
// Workout's WorkoutHistorySummary and Wellness's WellnessHistorySummary).

export type TodayStatus = 'done' | 'not_done' | 'pending';

export interface HabitWithProgress {
  habit: Habit;
  streak: HabitStreak;
  todayStatus: TodayStatus;
}

export interface DueHabitReminder {
  habitId: string;
  habitName: string;
  reminderTime: string;
}

export interface HabitSummary {
  /** false triggers onboarding — offer to create a first habit. */
  hasAnyHistory: boolean;
  habits: HabitWithProgress[];
  dueReminders: DueHabitReminder[];
}
