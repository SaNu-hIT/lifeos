// Pure PR-detection logic — no I/O, no clock (the caller passes in a set that
// already happened). A set is a weight PR if it beats the prior best weight, a
// volume PR if weight*reps beats the prior best single-set volume, or both.

import type { PersonalRecord, PrKind } from './types.js';

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface PrCandidateSet {
  weightKg: number;
  reps: number;
}

export interface PrEvaluation {
  isPr: boolean;
  kind?: PrKind;
  /** The record as it should be persisted after this set (unchanged if not a PR). */
  updated: Pick<
    PersonalRecord,
    'bestWeightKg' | 'bestWeightReps' | 'bestVolume' | 'bestVolumeSetWeightKg' | 'bestVolumeSetReps'
  >;
}

export function evaluatePr(
  prior: PersonalRecord | undefined,
  set: PrCandidateSet,
): PrEvaluation {
  const volume = set.weightKg * set.reps;

  if (!prior) {
    return {
      isPr: true,
      kind: 'both',
      updated: {
        bestWeightKg: set.weightKg,
        bestWeightReps: set.reps,
        bestVolume: volume,
        bestVolumeSetWeightKg: set.weightKg,
        bestVolumeSetReps: set.reps,
      },
    };
  }

  const isWeightPr = set.weightKg > prior.bestWeightKg;
  const isVolumePr = volume > prior.bestVolume;

  if (!isWeightPr && !isVolumePr) {
    return {
      isPr: false,
      updated: {
        bestWeightKg: prior.bestWeightKg,
        bestWeightReps: prior.bestWeightReps,
        bestVolume: prior.bestVolume,
        bestVolumeSetWeightKg: prior.bestVolumeSetWeightKg,
        bestVolumeSetReps: prior.bestVolumeSetReps,
      },
    };
  }

  const kind: PrKind = isWeightPr && isVolumePr ? 'both' : isWeightPr ? 'weight' : 'volume';
  return {
    isPr: true,
    kind,
    updated: {
      bestWeightKg: isWeightPr ? set.weightKg : prior.bestWeightKg,
      bestWeightReps: isWeightPr ? set.reps : prior.bestWeightReps,
      bestVolume: isVolumePr ? volume : prior.bestVolume,
      bestVolumeSetWeightKg: isVolumePr ? set.weightKg : prior.bestVolumeSetWeightKg,
      bestVolumeSetReps: isVolumePr ? set.reps : prior.bestVolumeSetReps,
    },
  };
}
