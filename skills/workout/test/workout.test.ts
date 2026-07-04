import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import type { DomainEvent, Tool, UnifiedContext } from '@lifeos/contracts';
import {
  createWorkoutSkill,
  normalizeExerciseName,
  type Equipment,
  type Exercise,
  type ExerciseCatalogPort,
  type MuscleGroup,
  type PersonalRecord,
  type SessionStatus,
  type SetEntry,
  type WorkoutPrRepositoryPort,
  type WorkoutProfile,
  type WorkoutProfileRepositoryPort,
  type WorkoutSession,
  type WorkoutSessionRepositoryPort,
  type WorkoutSetRepositoryPort,
} from '../src/index.js';

// ── Test doubles ────────────────────────────────────────────────────────────
class InMemorySessionRepo implements WorkoutSessionRepositoryPort {
  private sessions = new Map<string, WorkoutSession>();
  async createSession(session: WorkoutSession): Promise<void> {
    this.sessions.set(session.id, session);
  }
  async getActiveSession(userId: string): Promise<WorkoutSession | undefined> {
    return [...this.sessions.values()].find((s) => s.userId === userId && s.status === 'active');
  }
  async getSession(userId: string, sessionId: string): Promise<WorkoutSession | undefined> {
    const s = this.sessions.get(sessionId);
    return s && s.userId === userId ? s : undefined;
  }
  async finishSession(
    userId: string,
    sessionId: string,
    patch: { finishedAt: string; title?: string; notes?: string; status: SessionStatus },
  ): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s || s.userId !== userId) return;
    this.sessions.set(sessionId, { ...s, ...patch });
  }
  async recentSessions(userId: string, limit: number): Promise<WorkoutSession[]> {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId && s.status === 'finished')
      .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
      .slice(0, limit);
  }
}

class InMemorySetRepo implements WorkoutSetRepositoryPort {
  private sets = new Map<string, SetEntry>();
  async addSet(set: SetEntry): Promise<void> {
    this.sets.set(set.id, set);
  }
  async updateSet(
    userId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'rpe' | 'notes'>>,
  ): Promise<SetEntry | undefined> {
    const s = this.sets.get(setId);
    if (!s || s.userId !== userId) return undefined;
    const updated = { ...s, ...patch };
    this.sets.set(setId, updated);
    return updated;
  }
  async deleteSet(userId: string, setId: string): Promise<void> {
    const s = this.sets.get(setId);
    if (s && s.userId === userId) this.sets.delete(setId);
  }
  async getSet(userId: string, setId: string): Promise<SetEntry | undefined> {
    const s = this.sets.get(setId);
    return s && s.userId === userId ? s : undefined;
  }
  async setsForSession(userId: string, sessionId: string): Promise<SetEntry[]> {
    return [...this.sets.values()].filter((s) => s.userId === userId && s.sessionId === sessionId);
  }
  async recentSetsForExercise(userId: string, exerciseNameNormalized: string, limit: number): Promise<SetEntry[]> {
    return [...this.sets.values()]
      .filter((s) => s.userId === userId && normalizeExerciseName(s.exerciseName) === exerciseNameNormalized)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
  async lastPerformedByMuscle(): Promise<Partial<Record<MuscleGroup, string>>> {
    return {};
  }
}

class InMemoryPrRepo implements WorkoutPrRepositoryPort {
  private prs = new Map<string, PersonalRecord>();
  private key(userId: string, exerciseName: string): string {
    return `${userId}::${exerciseName}`;
  }
  async getPr(userId: string, exerciseNameNormalized: string): Promise<PersonalRecord | undefined> {
    return this.prs.get(this.key(userId, exerciseNameNormalized));
  }
  async upsertPr(record: PersonalRecord): Promise<void> {
    this.prs.set(this.key(record.userId, record.exerciseName), record);
  }
  async listPrs(userId: string): Promise<PersonalRecord[]> {
    return [...this.prs.values()].filter((p) => p.userId === userId);
  }
}

class InMemoryProfileRepo implements WorkoutProfileRepositoryPort {
  private profiles = new Map<string, WorkoutProfile>();
  async getProfile(userId: string): Promise<WorkoutProfile | undefined> {
    return this.profiles.get(userId);
  }
  async saveProfile(profile: WorkoutProfile): Promise<void> {
    this.profiles.set(profile.userId, profile);
  }
}

const BENCH: Exercise = { id: 'bench_press', name: 'Bench Press', primaryMuscle: 'chest', equipment: 'barbell' };

class InMemoryCatalog implements ExerciseCatalogPort {
  async findByName(nameNormalized: string): Promise<Exercise | undefined> {
    return nameNormalized === 'bench press' ? BENCH : undefined;
  }
  async search(query: string): Promise<Exercise[]> {
    return [BENCH].filter((e) => e.name.toLowerCase().includes(query.toLowerCase()));
  }
  async list(filter?: { muscle?: MuscleGroup; equipment?: Equipment }): Promise<Exercise[]> {
    return [BENCH].filter(
      (e) => (!filter?.muscle || e.primaryMuscle === filter.muscle) && (!filter?.equipment || e.equipment === filter.equipment),
    );
  }
}

function ctxFor(userId: string, nowIso = '2026-07-01T12:00:00.000Z'): UnifiedContext {
  return {
    user: { id: userId, locale: 'en-IN', timezone: 'Asia/Kolkata' },
    capabilities: ['workout.read', 'workout.track'],
    conversation: { id: 'c1', recentTurns: [] },
    memory: { facts: [], preferences: [], summaries: [] },
    settings: {},
    scope: 'workout',
    now: nowIso,
  };
}

function tool(tools: Tool[], name: string): Tool {
  const t = tools.find((x) => x.name === name);
  if (!t) throw new Error(`no such tool: ${name}`);
  return t;
}

describe('@lifeos/skill-workout', () => {
  function setup(clock = '2026-07-01T12:00:00.000Z') {
    const sessions = new InMemorySessionRepo();
    const sets = new InMemorySetRepo();
    const prs = new InMemoryPrRepo();
    const profiles = new InMemoryProfileRepo();
    const catalog = new InMemoryCatalog();
    let seq = 0;
    const published: DomainEvent[] = [];
    const skill = createWorkoutSkill({
      sessions,
      sets,
      prs,
      profiles,
      catalog,
      newId: () => `id-${(seq += 1)}`,
      now: () => clock,
      publish: async (event) => {
        published.push(event);
      },
    });
    return { sessions, sets, prs, profiles, catalog, skill, tools: skill.tools, published };
  }

  it('passes the skill contract kit', () => {
    const { skill } = setup();
    expect(() => runSkillContractTests(skill)).not.toThrow();
  });

  it('namespaces every tool and gates mutations behind the right capability', () => {
    const { tools } = setup();
    expect(tools.every((t) => t.name.startsWith('workout.'))).toBe(true);
    expect(tool(tools, 'workout.log_set').requiredCapability).toBe('workout.track');
    expect(tool(tools, 'workout.get_history_summary').requiredCapability).toBe('workout.read');
    expect(tool(tools, 'workout.edit_set').requiresConfirmation).toBe(true);
    expect(tool(tools, 'workout.delete_set').requiresConfirmation).toBe(true);
    expect(tool(tools, 'workout.log_set').requiresConfirmation).toBe(false);
  });

  it('runs a full session lifecycle: start → log sets → finish', async () => {
    const { tools, sets } = setup();
    const ctx = ctxFor('u1');

    const start = await tool(tools, 'workout.start_session').handler(ctx, { title: 'Push Day' });
    expect(start.alreadyActive).toBe(false);
    const sessionId = start.sessionId;

    const log1 = await tool(tools, 'workout.log_set').handler(ctx, {
      sessionId,
      exerciseName: 'Bench Press',
      weightKg: 80,
      reps: 5,
    });
    expect(log1.isPr).toBe(true);
    expect(log1.prKind).toBe('both');
    expect(log1.matchedCatalogExercise).toBe('Bench Press');
    expect(log1.setNumber).toBe(1);

    const log2 = await tool(tools, 'workout.log_set').handler(ctx, {
      sessionId,
      exerciseName: 'Bench Press',
      weightKg: 80,
      reps: 3,
    });
    expect(log2.isPr).toBe(false);
    expect(log2.setNumber).toBe(2);

    const finish = await tool(tools, 'workout.finish_session').handler(ctx, { sessionId });
    expect(finish.totalSets).toBe(2);
    expect(finish.prCount).toBe(1);

    expect((await sets.setsForSession('u1', sessionId)).length).toBe(2);
  });

  it('log_set/finish_session default to the active session when sessionId is omitted', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u10');
    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, {});

    const log = await tool(tools, 'workout.log_set').handler(ctx, {
      exerciseName: 'Bench Press',
      weightKg: 60,
      reps: 5,
    });
    expect(log.isPr).toBe(true);

    const finish = await tool(tools, 'workout.finish_session').handler(ctx, {});
    expect(finish.sessionId).toBe(sessionId);
    expect(finish.totalSets).toBe(1);
  });

  it('returns the existing session id instead of erroring on a second start_session', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u2');
    const first = await tool(tools, 'workout.start_session').handler(ctx, {});
    const second = await tool(tools, 'workout.start_session').handler(ctx, {});
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.alreadyActive).toBe(true);
  });

  it('detects weight PRs, volume PRs, and non-PRs correctly', async () => {
    const { tools, prs } = setup();
    const ctx = ctxFor('u3');
    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, {});
    const logSet = tool(tools, 'workout.log_set');

    const first = await logSet.handler(ctx, { sessionId, exerciseName: 'Squat', weightKg: 100, reps: 5 });
    expect(first.isPr).toBe(true);
    expect(first.prKind).toBe('both'); // no prior record

    const heavier = await logSet.handler(ctx, { sessionId, exerciseName: 'Squat', weightKg: 105, reps: 3 });
    expect(heavier.isPr).toBe(true);
    expect(heavier.prKind).toBe('weight'); // 105*3=315 < 100*5=500, so volume didn't improve

    const higherVolume = await logSet.handler(ctx, { sessionId, exerciseName: 'Squat', weightKg: 90, reps: 8 });
    expect(higherVolume.isPr).toBe(true);
    expect(higherVolume.prKind).toBe('volume'); // 90*8=720 > 500, but 90 < 105

    const noPr = await logSet.handler(ctx, { sessionId, exerciseName: 'Squat', weightKg: 80, reps: 5 });
    expect(noPr.isPr).toBe(false);

    const record = await prs.getPr('u3', 'squat');
    expect(record?.bestWeightKg).toBe(105);
    expect(record?.bestVolume).toBe(720);
  });

  it('recomputes PR status for the edited set only (v1 scope, no full rescan)', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u4');
    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, {});
    const log = await tool(tools, 'workout.log_set').handler(ctx, {
      sessionId,
      exerciseName: 'Deadlift',
      weightKg: 100,
      reps: 3,
    });
    expect(log.isPr).toBe(true);

    const edited = await tool(tools, 'workout.edit_set').handler(ctx, { setId: log.setId, weightKg: 150 });
    expect(edited.recomputedPr).toBe(true);
  });

  it('deletes a mistakenly logged set', async () => {
    const { tools, sets } = setup();
    const ctx = ctxFor('u5');
    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, {});
    const log = await tool(tools, 'workout.log_set').handler(ctx, {
      sessionId,
      exerciseName: 'Row',
      weightKg: 50,
      reps: 10,
    });
    await tool(tools, 'workout.delete_set').handler(ctx, { setId: log.setId });
    expect(await sets.getSet('u5', log.setId)).toBeUndefined();
  });

  it('tracks freeform exercises (no catalog match) with PRs keyed on normalized name', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u6');
    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, {});
    const log = await tool(tools, 'workout.log_set').handler(ctx, {
      sessionId,
      exerciseName: 'Cable Woodchopper',
      weightKg: 20,
      reps: 12,
    });
    expect(log.matchedCatalogExercise).toBeUndefined();
    expect(log.isPr).toBe(true);

    const history = await tool(tools, 'workout.get_exercise_history').handler(ctx, {
      exerciseName: 'cable woodchopper',
    });
    expect(history.personalRecord?.bestWeightKg).toBe(20);
  });

  it('get_history_summary signals onboarding state across fresh / profile-only / has-history', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u7');

    const fresh = await tool(tools, 'workout.get_history_summary').handler(ctx, {});
    expect(fresh.hasAnyHistory).toBe(false);
    expect(fresh.hasProfile).toBe(false);

    await tool(tools, 'workout.save_profile').handler(ctx, {
      frequencyPerWeek: 3,
      goals: ['strength'],
      experience: 'beginner',
      availableEquipment: ['barbell', 'dumbbell'],
    });
    const profileOnly = await tool(tools, 'workout.get_history_summary').handler(ctx, {});
    expect(profileOnly.hasProfile).toBe(true);
    expect(profileOnly.hasAnyHistory).toBe(false);

    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, { title: 'Leg Day' });
    await tool(tools, 'workout.log_set').handler(ctx, { sessionId, exerciseName: 'Squat', weightKg: 100, reps: 5 });
    await tool(tools, 'workout.finish_session').handler(ctx, { sessionId });

    const withHistory = await tool(tools, 'workout.get_history_summary').handler(ctx, {});
    expect(withHistory.hasAnyHistory).toBe(true);
    expect(withHistory.recentSessions).toHaveLength(1);
    expect(withHistory.recentSessions[0]!.exercises[0]!.exerciseName).toBe('Squat');
  });

  it('publishes a PR event only when a set is actually a PR', async () => {
    const { tools, published } = setup();
    const ctx = ctxFor('u8');
    const { sessionId } = await tool(tools, 'workout.start_session').handler(ctx, {});
    await tool(tools, 'workout.log_set').handler(ctx, { sessionId, exerciseName: 'OHP', weightKg: 40, reps: 5 });
    await tool(tools, 'workout.log_set').handler(ctx, { sessionId, exerciseName: 'OHP', weightKg: 30, reps: 5 });
    expect(published.filter((e) => e.type === 'workout.pr_achieved')).toHaveLength(1);
  });

  it('list_exercises always notes freeform names are accepted', async () => {
    const { tools } = setup();
    const ctx = ctxFor('u9');
    const result = await tool(tools, 'workout.list_exercises').handler(ctx, { query: 'bench' });
    expect(result.exercises[0]!.name).toBe('Bench Press');
    expect(result.note).toMatch(/not limited/i);
  });
});
