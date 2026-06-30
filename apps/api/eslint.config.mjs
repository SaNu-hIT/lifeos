import { base, withBoundaries, CORE_FORBIDDEN_IMPORTS } from '@lifeos/eslint-config';

// apps/api is the platform CORE. It must never import a Skill or Connector —
// those are registered at runtime via the registries (docs/adr/adr-0001-modular-monolith.md).
export default [...base, withBoundaries(CORE_FORBIDDEN_IMPORTS)];
