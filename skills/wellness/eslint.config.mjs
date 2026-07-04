import { base, withBoundaries, SKILL_FORBIDDEN_IMPORTS } from '@lifeos/eslint-config';

// Skills must not call the LLM directly (ADR-0004) — logic lives in the Skill,
// language work goes through platform-mediated tools.
export default [...base, withBoundaries(SKILL_FORBIDDEN_IMPORTS)];
