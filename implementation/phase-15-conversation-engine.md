---
title: Phase 15 — Conversation Engine
status: Scaffold
band: Core
phase: 15
depends_on: [4, 6]
estimate: 4–5 days
---

# Phase 15 — Conversation Engine

> Scaffold. Spec refs: [02 §5](../docs/02_LifeOS_Platform_Architecture.md) · [09 conversation.\*](../docs/09_DATABASE_DESIGN.md).

## Overview
Own conversations, messages, turns, and streaming state. Persist every turn; emit `message.received`. Provides the surface the Orchestrator (phase-16) drives and the realtime layer (phase-29) streams.

## Objectives & Scope
- `conversation.conversations/messages` repositories; turn grouping.
- Create conversation, append message, paginate history (keyset, [10 §4](../docs/10_API_STANDARD.md)).
- Emit domain events on message/turn lifecycle; `turnId` in request context.

## Key interfaces (to finalize)
```ts
export interface ConversationPort {
  start(userId: string): Promise<Conversation>;
  appendMessage(input: NewMessage): Promise<Message>;
  history(conversationId: string, page: PageQuery): Promise<Page<Message>>;
}
```

## Dependencies
Phase-04 (schema), phase-06 (events). Consumed by 16, 28, 29.

## Acceptance Criteria (draft)
- [ ] Conversations/messages persist; turns grouped; history paginated.
- [ ] Events emitted on message/turn.

## Definition of Done (draft)
- [ ] `ConversationPort` in contracts; tests green; [06](../docs/06_PROJECT_STATE.md) updated; DB version bumped.

## AI Coding Prompt
See [prompts/phase-15.md](../prompts/phase-15.md).

## Known Risks
- Long threads → conversation summaries (Memory, phase-12) keep context bounded.

## Future Extension Points
Multi-modal messages (voice/image); message editing; conversation sharing.
