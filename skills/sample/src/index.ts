// @lifeos/skill-sample — a trivial reference Skill that proves the plugin path.
// It depends only on the SDK + contracts, never on the platform core (ADR-0001).
// As of phase 22 it also exercises the full contribution surface: a tool, an
// activity projection, a notification declaration, and a home widget.

import { type DomainEvent, type Tool, type UnifiedContext } from '@lifeos/contracts';
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

/** Payload shape of the `sample.echoed` domain event this Skill reacts to. */
interface EchoedPayload {
  text: string;
}

export const sampleSkill = defineSkill({
  key: 'sample',
  version: '1.1.0',
  contractVersion: '^0.9.0',
  capabilities: [{ key: 'sample.use', description: 'Use the sample skill' }],
  tools: [echoTool],
  activityProjections: [
    {
      key: 'sample.echoed',
      on: 'sample.echoed',
      build: (event: DomainEvent) => ({
        userId: event.userId!,
        kind: 'sample.echoed',
        title: 'Echoed a message',
        summary: (event.payload as EchoedPayload).text,
        occurredAt: event.occurredAt,
      }),
    },
  ],
  notifications: [
    {
      key: 'sample.echoed',
      on: 'sample.echoed',
      build: (event: DomainEvent) => ({
        userId: event.userId!,
        kind: 'sample.echoed',
        title: 'Your echo is ready',
        body: (event.payload as EchoedPayload).text,
        importance: 'normal',
        channels: ['in_app'],
        occurredAt: event.occurredAt,
      }),
    },
  ],
  widgets: [
    {
      key: 'sample.hello',
      title: 'Hello from Sample',
      requiredCapability: 'sample.use',
      priority: 1,
      build: async () => ({ props: { message: 'Sample skill is installed' } }),
    },
  ],
});
