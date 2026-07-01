// @lifeos/skill-sample — a trivial reference Skill that proves the plugin path.
// It depends only on the SDK + contracts, never on the platform core (ADR-0001).

import { type Tool, type UnifiedContext } from '@lifeos/contracts';
import { defineSkill } from '@lifeos/skill-sdk';

interface EchoArgs {
  text: string;
}

const echoTool: Tool<EchoArgs, EchoArgs> = {
  name: 'sample.echo',
  inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  requiredCapability: 'sample.use',
  idempotent: true,
  requiresConfirmation: false,
  handler: async (_ctx: UnifiedContext, args: EchoArgs) => ({ text: args.text }),
};

export const sampleSkill = defineSkill({
  key: 'sample',
  version: '1.0.0',
  contractVersion: '^0.6.0',
  capabilities: [{ key: 'sample.use', description: 'Use the sample skill' }],
  tools: [echoTool],
});
