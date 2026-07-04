// Workout's domain model. Unlike Grocery/Calendar there is no external connector —
// this Skill is pure first-party persistence (docs/01 §2: Skills need not wrap a
// third party). PRs and history are keyed on the *normalized* exercise name, not a
// catalog id, so freeform exercises (never in the seeded catalog) still accrue a
// full PR/history trail — the catalog is grounding data only, never a gate.

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'full_body';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'bands'
  | 'other';

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment;
  /** true for a freeform exercise the user typed that isn't in the seeded catalog. */
  isCustom?: boolean;
}

export type PrKind = 'weight' | 'volume' | 'both';

export interface SetEntry {
  id: string;
  sessionId: string;
  userId: string;
  /** Freeform text as logged — always populated, even when it matches the catalog. */
  exerciseName: string;
  /** Resolved catalog id, if `exerciseName` matched one. Undefined for freeform. */
  exerciseId?: string;
  /** Order of this set within its exercise, for this session. */
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  notes?: string;
  /** Computed at log/edit time, denormalized for fast reads. */
  isPr: boolean;
  prKind?: PrKind;
  createdAt: string;
}

export type SessionStatus = 'active' | 'finished' | 'cancelled';

export interface WorkoutSession {
  id: string;
  userId: string;
  status: SessionStatus;
  title?: string;
  startedAt: string;
  finishedAt?: string;
  notes?: string;
}

export interface PersonalRecord {
  id: string;
  userId: string;
  /** Normalized (lowercase/trim/collapsed-whitespace) exercise name — the PR key. */
  exerciseName: string;
  bestWeightKg: number;
  bestWeightReps: number;
  bestVolume: number;
  bestVolumeSetWeightKg: number;
  bestVolumeSetReps: number;
  achievedAt: string;
  sourceSetId: string;
}

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness' | 'fat_loss';

export interface WorkoutProfile {
  userId: string;
  frequencyPerWeek: number;
  goals: TrainingGoal[];
  experience: ExperienceLevel;
  availableEquipment: Equipment[];
  preferredDurationMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

// ── Shapes fed to the LLM for AI-composed suggestions ───────────────────────────
// These carry DATA only. The Skill never authors a suggestion itself (product
// requirement: the planner/LLM reasons over history, no rule-based recommender
// lives in the tool layer).

export interface RecentSessionSummary {
  sessionId: string;
  startedAt: string;
  finishedAt?: string;
  title?: string;
  exercises: { exerciseName: string; setCount: number; topSet: { weightKg: number; reps: number } }[];
}

export interface ExerciseRecentActivity {
  exerciseName: string;
  lastPerformedAt: string;
  recentSets: { weightKg: number; reps: number; rpe?: number; performedAt: string }[];
  personalRecord?: PersonalRecord;
}

export interface MuscleGroupRecency {
  muscle: MuscleGroup;
  /** null when the muscle has never been trained. */
  daysSinceLastTrained: number | null;
}

export interface WorkoutHistorySummary {
  /** false triggers the onboarding flow — ask about schedule/goals before suggesting. */
  hasAnyHistory: boolean;
  hasProfile: boolean;
  recentSessions: RecentSessionSummary[];
  perExercise: ExerciseRecentActivity[];
  muscleGroupRecency: MuscleGroupRecency[];
  activeSessionId?: string;
  profile?: WorkoutProfile;
}
