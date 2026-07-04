// Assistant tools — lets the user ask what the assistant can do for THEM specifically,
// and see what's locked behind a plan they don't have. Data-only (ADR-0004): the
// handler hands the LLM structured facts (owned/locked capabilities, unlock plans,
// upgrade URL); it does not author the reply itself.

import type { Tool, UnifiedContext } from '@lifeos/contracts';
import type { PlanCatalogPort, PlanSummary } from './ports/plan-catalog.port.js';

export interface InstalledSkillSummary {
  key: string;
  title?: string;
  description?: string;
  capabilities: { key: string; description: string }[];
}

export interface CapabilitySummary {
  skillKey: string;
  skillTitle: string;
  skillDescription?: string;
  capabilityKey: string;
  capabilityDescription: string;
}

export interface LockedCapabilitySummary extends CapabilitySummary {
  /** Plans that would unlock this capability (empty if none currently do). */
  unlockedByPlans: PlanSummary[];
}

export interface ListCapabilitiesOutput {
  currentPlan?: string;
  available: CapabilitySummary[];
  locked: LockedCapabilitySummary[];
  upgradeUrl: string;
}

export interface AssistantToolDeps {
  /** Every installed Skill's manifest summary — the static source of truth for
   *  which skills/capabilities exist, gathered once when manifests are built. */
  installedSkills: InstalledSkillSummary[];
  planCatalog: PlanCatalogPort;
  /** Informational link to the upgrade/pricing page — never mutates a plan from chat. */
  upgradeUrl: string;
}

export function createAssistantTools(deps: AssistantToolDeps): Tool[] {
  const listCapabilities: Tool<Record<string, never>, ListCapabilitiesOutput> = {
    name: 'assistant.list_capabilities',
    description:
      'Explains what the assistant can currently do for THIS user and what is locked ' +
      'behind a paid plan. Call this whenever the user asks what you can do, what ' +
      'features or skills they have, what is included in their plan, or how to unlock ' +
      'something (e.g. "what can you do", "what features do I have", "what\'s in my ' +
      'plan", "how do I unlock X"). Takes no arguments.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        currentPlan: { type: 'string' },
        available: { type: 'array' },
        locked: { type: 'array' },
        upgradeUrl: { type: 'string' },
      },
      required: ['available', 'locked', 'upgradeUrl'],
    },
    requiredCapability: 'assistant.use',
    idempotent: true,
    requiresConfirmation: false,
    handler: async (ctx: UnifiedContext) => {
      const have = new Set<string>(ctx.capabilities);
      const available: CapabilitySummary[] = [];
      const lockedMeta: CapabilitySummary[] = [];

      for (const skill of deps.installedSkills) {
        for (const cap of skill.capabilities) {
          const row: CapabilitySummary = {
            skillKey: skill.key,
            skillTitle: skill.title ?? skill.key,
            skillDescription: skill.description,
            capabilityKey: cap.key,
            capabilityDescription: cap.description,
          };
          if (have.has(row.capabilityKey)) available.push(row);
          else lockedMeta.push(row);
        }
      }

      const [currentPlan, unlocks] = await Promise.all([
        deps.planCatalog.currentPlan(ctx.user.id),
        deps.planCatalog.plansGranting(lockedMeta.map((row) => row.capabilityKey)),
      ]);
      const unlockByCap = new Map(unlocks.map((u) => [u.capabilityKey, u.plans]));
      const locked: LockedCapabilitySummary[] = lockedMeta.map((row) => ({
        ...row,
        unlockedByPlans: unlockByCap.get(row.capabilityKey) ?? [],
      }));

      return { currentPlan, available, locked, upgradeUrl: deps.upgradeUrl };
    },
  };

  return [listCapabilities];
}
