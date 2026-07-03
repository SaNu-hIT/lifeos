import { base, withBoundaries, SKILL_FORBIDDEN_IMPORTS } from '@lifeos/eslint-config';

// Connectors, like Skills, must not call the LLM directly (ADR-0004).
export default [...base, withBoundaries(SKILL_FORBIDDEN_IMPORTS)];
