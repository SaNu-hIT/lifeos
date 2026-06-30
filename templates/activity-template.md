---
title: Activity Template
status: Authoritative
version: 1.0.0
type: template
---

# Activity Template

> Copy this to emit an **activity** — an entry in the append-only activity feed. Activities are a factual log of what LifeOS did. They are produced by **event subscribers** that build the Activity read model (CQRS), not written inline by Skills.

References: [02 §15](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0008](../docs/adr/adr-0008-event-driven-outbox.md)

## Pattern: domain event → activity projection

```ts
// A Skill emits a domain event (via outbox) — it does NOT write activities directly.
order.recordEvent('grocery.order_placed', { orderId, total, currency });

// The Activity Engine subscribes and projects to the feed read model.
import { defineActivityProjection } from '@lifeos/platform-core';

export const orderPlacedActivity = defineActivityProjection({
  on: 'grocery.order_placed',
  build: (e): ActivityEntry => ({
    userId: e.userId,
    kind: 'grocery.order_placed',
    title: 'Ordered groceries',
    summary: formatMoney(e.payload.total, e.payload.currency),
    occurredAt: e.occurredAt,
    deepLink: orderLink(e.payload.orderId),
  }),
  idempotencyKey: (e) => `${e.eventId}`,   // at-least-once → dedupe
});
```

## Rules checklist

- [ ] Activities are produced from **domain events**, not written inline by Skills.
- [ ] Projection is **idempotent** (events deliver at-least-once → dedupe by event id).
- [ ] `surface.activities` is **append-only** (no updates/deletes) ([09](../docs/09_DATABASE_DESIGN.md)).
- [ ] No sensitive payloads in the feed (summaries/refs only).
- [ ] Activity is factual and low-noise (distinct from opt-in notifications).

## Tests

- [ ] Unit: projection maps event → `ActivityEntry`.
- [ ] Idempotency: replaying the event produces no duplicate row.
- [ ] Integration: event → subscriber → feed read model.

## Definition of Done

- [ ] Activity appears in the feed after the triggering event.
- [ ] Append-only + idempotent verified; tests green.
- [ ] Docs + [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) updated.

## Future extension points

- Grouping/threading of related activities; per-Skill feed filters; activity-driven analytics.
