import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import { base, withBoundaries, CORE_FORBIDDEN_IMPORTS } from '@lifeos/eslint-config';

// The dependency-direction guardrail is the load-bearing artifact of Phase 01.
// This NEGATIVE TEST proves the rule actually fires: importing a Skill/Connector
// from the core (apps/api) must be a lint error (docs/adr/adr-0001-modular-monolith.md).

const linter = new Linter({ configType: 'flat' });
// Cast: the shared config is a plain flat-config array; ESLint's Linter accepts it.
const config = [...base, withBoundaries(CORE_FORBIDDEN_IMPORTS)] as Parameters<Linter['verify']>[1];

function boundaryErrors(code: string) {
  return linter
    .verify(code, config, { filename: 'src/forbidden.ts' })
    .filter((m) => m.ruleId === 'no-restricted-imports');
}

describe('core dependency-direction boundary', () => {
  it('REJECTS importing a Skill from the core', () => {
    expect(boundaryErrors("import { thing } from '@lifeos/skill-grocery';").length).toBeGreaterThan(0);
  });

  it('REJECTS importing a Connector from the core', () => {
    expect(boundaryErrors("import { thing } from '@lifeos/connector-zepto';").length).toBeGreaterThan(0);
  });

  it('REJECTS a relative reach into skills/', () => {
    expect(boundaryErrors("import { thing } from '../../skills/grocery/src/index.js';").length).toBeGreaterThan(0);
  });

  it('ALLOWS importing platform contracts', () => {
    expect(boundaryErrors("import { CONTRACTS_VERSION } from '@lifeos/contracts';").length).toBe(0);
  });
});
