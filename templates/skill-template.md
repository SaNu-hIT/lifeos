---
title: Skill Template
status: Authoritative
version: 1.0.0
type: template
---

# Skill Template

> Copy this to build a new **Skill** (a self-contained capability plugin). A Skill owns its business logic, context providers, tools, widgets, activities, notifications, capability requirements, and config — and **nothing** outside its domain. It never imports another Skill, never calls the LLM, and never queries cross-cutting data directly.

References: [02 §10 Skill System](../docs/02_LifeOS_Platform_Architecture.md) · [03 Handbook](../docs/03_LifeOS_Engineering_Handbook.md) · [widget-template](widget-template.md) · [activity-template](activity-template.md) · [notification-template](notification-template.md)

## Folder structure

```
skills/<skill>/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   ├── value-objects/
│   │   ├── events/                 # <skill>.<thing>_<pastTense>
│   │   └── ports/                  # interfaces (incl. provider ports)
│   ├── application/
│   │   ├── commands/
│   │   ├── queries/
│   │   └── services/
│   ├── adapters/
│   │   ├── in/
│   │   │   ├── tools/              # tool handlers (entrypoints)
│   │   │   ├── context-providers/ # contribute to Unified Context
│   │   │   └── event-handlers/    # react to domain events
│   │   └── out/
│   │       └── repositories/      # <skill> schema persistence
│   ├── widgets/                   # home widget contributions
│   ├── notifications/             # notification declarations/templates
│   ├── config/                    # config schema + defaults
│   ├── <skill>.manifest.ts        # plugin manifest (registration)
│   └── <skill>.module.ts          # NestJS DI wiring
├── migrations/                    # <skill> schema migrations
└── test/
    ├── unit/
    ├── contract/                  # runSkillContractTests(<skill>)
    └── integration/
```

## Manifest (registration)

```ts
import { defineSkill } from '@lifeos/skill-sdk';

export default defineSkill({
  key: '<skill>',                       // 'grocery'
  version: '1.0.0',
  contractVersion: '^1.0.0',            // platform contract it targets
  capabilities: [                       // capabilities this Skill's tools require
    { key: '<skill>.read', description: '...' },
    { key: '<skill>.order', description: '...' },
  ],
  tools: [/* see tool stub below */],
  contextProviders: [/* ContextProvider[] */],
  widgets: [/* WidgetContribution[] */],
  notifications: [/* NotificationDeclaration[] */],
  eventHandlers: [/* { event, handler } */],
  configSchema: <skill>ConfigSchema,
});
```

## Tool stub (the unit the Planner calls)

```ts
import { Tool } from '@lifeos/contracts';

export const buildCartTool: Tool</*In*/, /*Out*/> = {
  name: '<skill>.build_cart',
  inputSchema,  outputSchema,
  requiredCapability: '<skill>.order',
  idempotent: false,
  requiresConfirmation: true,
  // Next-step buttons offered after this tool succeeds (docs/02 §11). Use the static
  // form when the next step is always relevant, or `followUpsFor(output, ctx)` when
  // it depends on the result (e.g. only offer it while a field is still missing).
  followUps: [{ label: '<Do the natural next thing>', prompt: '<message that triggers it>' }],
  async handler(ctx, args) {
    // ctx: UnifiedContext (already permission-filtered) — DO NOT query DB for cross-cutting data
    // call application command; provider access via Connector Registry (never name a vendor)
    return result;
  },
};
```

## Rules checklist (must all hold)

- [ ] Does **not** import any other Skill.
- [ ] Does **not** call the AI Core / LLM ([ADR-0004](../docs/adr/adr-0004-ai-no-business-logic.md)).
- [ ] Reads cross-cutting data only from `UnifiedContext` ([ADR-0007](../docs/adr/adr-0007-context-engine.md)); owns its domain schema.
- [ ] Reaches providers only via the Connector Registry / Provider SDK ([ADR-0005](../docs/adr/adr-0005-provider-sdk.md)).
- [ ] Every tool declares `requiredCapability`; consequential tools set `requiresConfirmation`.
- [ ] Every mutating tool considers `followUps`/`followUpsFor` — a real next step (button and/or a follow-up question) offered to the user, or an explicit call that none applies.
- [ ] No hardcoded values (providers, prices, flags) — config/manifest only.
- [ ] Cross-Skill effects via **events**, not direct calls.

## Tests

- [ ] Unit tests for domain/application (fabricate `UnifiedContext`, mock ports).
- [ ] `runSkillContractTests(<skill>)` passes (manifest, tool schemas, capabilities, lifecycle).
- [ ] Integration tests for the Skill's own schema (testcontainers).

## Definition of Done

- [ ] Manifest registers cleanly; Skill appears in registry/console.
- [ ] All tools execute end-to-end through Tool Registry with permission checks.
- [ ] Tests green at coverage gate ([12](../docs/12_TESTING_GUIDE.md)).
- [ ] Docs + [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) updated; new terms in [14 Glossary](../docs/14_GLOSSARY.md).

## Future extension points

- Marketplace packaging (signing, sandbox, capability allowlist).
- Additional providers via new connectors — no Skill change.
- Proactive behaviors by subscribing to more events.
