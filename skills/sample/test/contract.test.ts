import { describe, expect, it } from 'vitest';
import { runSkillContractTests } from '@lifeos/skill-sdk';
import { sampleSkill } from '../src/index.js';

describe('@lifeos/skill-sample', () => {
  it('passes the skill contract kit', () => {
    expect(() => runSkillContractTests(sampleSkill)).not.toThrow();
  });

  it('declares its tool namespaced under the skill key', () => {
    expect(sampleSkill.tools.every((t) => t.name.startsWith('sample.'))).toBe(true);
  });
});
