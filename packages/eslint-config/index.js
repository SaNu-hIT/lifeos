// @lifeos/eslint-config — shared flat ESLint config.
//
// `base` is the standard rule set for every package.
// `withBoundaries()` produces the dependency-direction guardrail that keeps the
// modular monolith modular (docs/adr/adr-0001-modular-monolith.md):
// the core (apps/api) must never import a Skill or Connector — those are wired
// at runtime via the registries, not at build time.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** Standard config applied by every workspace package. */
export const base = [
  { ignores: ['dist/**', 'node_modules/**', '.turbo/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
];

/**
 * Forbid importing the given patterns. Used to enforce architectural boundaries.
 * @param {string[]} patterns minimatch patterns matched against import specifiers
 * @param {string} [message]
 */
export function withBoundaries(patterns, message = 'Dependency-direction violation: this layer may not import that module (docs/adr/adr-0001-modular-monolith.md).') {
  return {
    rules: {
      'no-restricted-imports': ['error', { patterns: patterns.map((pattern) => ({ group: [pattern], message })) }],
    },
  };
}

/** The boundaries the platform core (apps/api) must respect. */
export const CORE_FORBIDDEN_IMPORTS = [
  '**/skills/**',
  '**/connectors/**',
  '@lifeos/skill-*',
  '@lifeos/connector-*',
];

/** Skills must never call the LLM directly (docs/adr/adr-0004-ai-no-business-logic.md);
 *  they expose needs as tools. Connectors likewise hold no AI logic. */
export const SKILL_FORBIDDEN_IMPORTS = ['@lifeos/ai-core'];

export default base;
