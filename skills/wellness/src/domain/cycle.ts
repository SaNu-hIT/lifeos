// Pure cycle-derivation and prediction logic — no I/O, no clock (callers pass `now`
// explicitly, docs/02 §8). A cycle is derived from consecutive flow-logged days, not
// stored as its own entity: the first flow-logged day after a gap starts a new cycle,
// and its length is the gap to the *next* cycle's start (so the last, still-ongoing
// cycle has no length yet and is excluded from the derived list).

import type { CyclePrediction, CycleDayEntry, DerivedCycle, PredictionConfidence } from './types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

/** Groups entries with `flow` set into runs of consecutive calendar days, then pairs
 *  each run's start with the *next* run's start to compute a cycle length. Entries
 *  must be pre-sorted or will be sorted here by date ascending. */
export function deriveCycles(entries: CycleDayEntry[]): DerivedCycle[] {
  const flowDays = [...entries]
    .filter((e) => e.flow != null)
    .map((e) => e.date)
    .sort();
  if (flowDays.length === 0) return [];

  const runs: { start: string; end: string }[] = [];
  let runStart = flowDays[0]!;
  let runEnd = flowDays[0]!;
  for (let i = 1; i < flowDays.length; i += 1) {
    const day = flowDays[i]!;
    if (daysBetween(runEnd, day) <= 1) {
      runEnd = day;
    } else {
      runs.push({ start: runStart, end: runEnd });
      runStart = day;
      runEnd = day;
    }
  }
  runs.push({ start: runStart, end: runEnd });

  const cycles: DerivedCycle[] = [];
  for (let i = 0; i < runs.length - 1; i += 1) {
    const current = runs[i]!;
    const next = runs[i + 1]!;
    cycles.push({
      start: current.start,
      end: current.end,
      lengthDays: daysBetween(current.start, next.start),
    });
  }
  return cycles;
}

/** Start date of the most recent flow-logged run, including a still-ongoing one that
 *  hasn't yet completed into a full derived cycle. This is the anchor a fallback
 *  prediction needs even when there's only ever been one period logged. */
export function lastFlowRunStart(entries: CycleDayEntry[]): string | undefined {
  const flowDays = [...entries]
    .filter((e) => e.flow != null)
    .map((e) => e.date)
    .sort();
  if (flowDays.length === 0) return undefined;

  let runStart = flowDays[0]!;
  let runEnd = flowDays[0]!;
  for (let i = 1; i < flowDays.length; i += 1) {
    const day = flowDays[i]!;
    if (daysBetween(runEnd, day) <= 1) {
      runEnd = day;
    } else {
      runStart = day;
      runEnd = day;
    }
  }
  return runStart;
}

/** Averages up to the last 6 derived cycles. Falls back to a user-reported average
 *  cycle length (from the profile) when there isn't enough real history yet — anchored
 *  on the last logged flow-run start even if it never completed into a full cycle.
 *  Confidence is 'low' below 3 cycles, 'medium' at 3-5, 'high' at 6+. */
export function predictNextCycle(
  cycles: DerivedCycle[],
  now: string,
  fallbackAvgCycleLengthDays?: number,
  fallbackLastStart?: string,
): CyclePrediction | undefined {
  const recent = cycles.slice(-6);
  // A derived cycle's `start` is its *own* run's start, one run behind the most
  // recently logged one (see deriveCycles: cycle[i] pairs run[i] with run[i+1]'s
  // start only to compute length). The anchor for a *future* prediction must be the
  // most recent run's start, so prefer the caller-supplied last-run anchor when given.
  const lastKnownStart = fallbackLastStart ?? (cycles.length > 0 ? cycles[cycles.length - 1]!.start : undefined);

  if (recent.length === 0) {
    if (fallbackAvgCycleLengthDays == null || lastKnownStart == null) return undefined;
    return {
      predictedNextStart: addDays(lastKnownStart, fallbackAvgCycleLengthDays),
      averageCycleLengthDays: fallbackAvgCycleLengthDays,
      averagePeriodLengthDays: 0,
      basedOnCycles: 0,
      confidence: 'low',
    };
  }

  const avgCycleLength = average(recent.map((c) => c.lengthDays));
  const avgPeriodLength = average(recent.map((c) => daysBetween(c.start, c.end) + 1));
  const confidence: PredictionConfidence = recent.length >= 6 ? 'high' : recent.length >= 3 ? 'medium' : 'low';

  const predictedNextStart = addDays(lastKnownStart!, avgCycleLength);
  return {
    predictedNextStart,
    predictedNextEnd: addDays(predictedNextStart, avgPeriodLength - 1),
    averageCycleLengthDays: Math.round(avgCycleLength),
    averagePeriodLengthDays: Math.round(avgPeriodLength),
    basedOnCycles: recent.length,
    confidence,
  };
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}
