// @lifeos/api — the LifeOS platform (NestJS modular monolith).
//
// Phase 01 ships this as a placeholder so the workspace graph and boundaries exist.
// The NestJS application bootstrap (versioned routing, global pipeline, /v1/health)
// lands in Phase 02 — see implementation/phase-02-backend.md.

import { CONTRACTS_VERSION } from '@lifeos/contracts';

export const PLATFORM_NAME = 'LifeOS' as const;

/** Placeholder entrypoint marker; replaced by the NestJS bootstrap in Phase 02. */
export function platformInfo(): { name: string; contractsVersion: string } {
  return { name: PLATFORM_NAME, contractsVersion: CONTRACTS_VERSION };
}
