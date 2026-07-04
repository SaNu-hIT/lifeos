// @lifeos/skill-assistant — lets the assistant explain its own capabilities to the
// user and nudge an upgrade when the user's ask maps to a locked (paid) feature.
// No connector, no persistence of its own: reads the already-built manifests of
// every other installed Skill plus the existing billing/plan tables (read-only).

import { type SkillManifest } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';
import { createAssistantTools, type AssistantToolDeps } from './tools.js';

export function createAssistantSkill(deps: AssistantToolDeps): SkillManifest {
  return defineSkill({
    key: 'assistant',
    version: '1.0.0',
    title: 'Assistant',
    description: 'Explains what the assistant can do and nudges upgrades for locked features.',
    contractVersion: '^0.9.0',
    capabilities: [
      { key: 'assistant.use', description: 'Ask what the assistant can do and see plan/upgrade info' },
    ],
    tools: createAssistantTools(deps),
  });
}

export type {
  PlanCatalogPort,
  PlanSummary,
  CapabilityUnlock,
} from './ports/plan-catalog.port.js';
export {
  createAssistantTools,
  type AssistantToolDeps,
  type InstalledSkillSummary,
  type ListCapabilitiesOutput,
  type CapabilitySummary,
  type LockedCapabilitySummary,
} from './tools.js';
