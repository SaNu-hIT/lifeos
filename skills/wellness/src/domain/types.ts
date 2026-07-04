// Wellness's domain model. Like Workout, this is pure first-party persistence — no
// external connector. A cycle isn't logged as its own entity; it's derived from
// consecutive flow-logged days (see domain/cycle.ts), so logging stays "one day at a
// time", the same simplicity Workout gets from "one set at a time".

export type FlowIntensity = 'spotting' | 'light' | 'medium' | 'heavy';

/** Freeform tag string — a small suggested set exists for autocomplete, but any tag
 *  is accepted, mirroring Workout's freeform exercise names. */
export const SUGGESTED_SYMPTOMS = [
  'cramps',
  'headache',
  'bloating',
  'mood swings',
  'fatigue',
  'acne',
  'tender breasts',
  'back pain',
] as const;

export interface CycleDayEntry {
  id: string;
  userId: string;
  /** ISO date (yyyy-mm-dd) — one entry per user per date (idempotent upsert). */
  date: string;
  flow?: FlowIntensity;
  symptoms?: string[];
  basalBodyTempC?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DerivedCycle {
  start: string;
  end: string;
  lengthDays: number;
}

export type PredictionConfidence = 'low' | 'medium' | 'high';

export interface CyclePrediction {
  predictedNextStart: string;
  predictedNextEnd?: string;
  averageCycleLengthDays: number;
  averagePeriodLengthDays: number;
  basedOnCycles: number;
  confidence: PredictionConfidence;
}

export type SupplyCategory = 'menstrual' | 'pain-relief' | 'other';

export interface SupplyItem {
  name: string;
  category?: SupplyCategory;
  defaultReminderDaysBefore: number;
}

export type ReminderKind = 'auto-supply' | 'manual';
export type ReminderStatus = 'pending' | 'dismissed' | 'done';

export interface Reminder {
  id: string;
  userId: string;
  kind: ReminderKind;
  label: string;
  dueDate: string;
  status: ReminderStatus;
  relatedSupplyItem?: string;
  createdAt: string;
}

export type TrackingGoal = 'cycle-prediction' | 'symptom-patterns' | 'fertility';

export interface WellnessProfile {
  userId: string;
  trackingGoals: TrackingGoal[];
  /** User-reported average cycle length, used as a prediction fallback until enough
   *  real history accrues (domain/cycle.ts prefers computed history when available). */
  averageCycleLengthDays?: number;
  supplyList: SupplyItem[];
  createdAt: string;
  updatedAt: string;
}

// ── Shapes fed to the LLM for AI-composed insights ──────────────────────────────
// DATA only — the Skill never authors a prediction narrative or canned advice
// itself (product requirement, same as Workout's WorkoutHistorySummary).

export interface RecentCycleSummary {
  start: string;
  end: string;
  lengthDays: number;
}

export interface WellnessHistorySummary {
  /** false triggers the onboarding flow — ask about goals/supply list before advising. */
  hasAnyHistory: boolean;
  hasProfile: boolean;
  recentCycles: RecentCycleSummary[];
  /** Frequency-ranked symptom tags across recent history, most common first. */
  recentSymptomTags: { tag: string; count: number }[];
  prediction?: CyclePrediction;
  pendingReminders: Reminder[];
  profile?: WellnessProfile;
}
