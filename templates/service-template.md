---
title: Service / Use-Case Template
status: Authoritative
version: 1.0.0
type: template
---

# Service / Use-Case Template (Application Layer)

> Copy this for an application **command** or **query** handler. This is where a use case is orchestrated: it coordinates the domain and ports. Business *rules* live in the domain; this layer sequences them.

References: [03 §8 CQRS](../docs/03_LifeOS_Engineering_Handbook.md) · [module-template](module-template.md)

## Command (write) stub

```ts
export interface PlaceOrderCommand { userId: string; cartId: string; idempotencyKey?: string; }

@Injectable()
export class PlaceOrderCommandHandler {
  constructor(
    private readonly orders: OrderRepositoryPort,
    private readonly provider: GroceryProviderPort,   // resolved via Connector Registry
    private readonly events: EventBusPort,            // outbox-backed
  ) {}

  async execute(cmd: PlaceOrderCommand): Promise<OrderResult> {
    const cart = await this.orders.getCart(cmd.userId, cmd.cartId);
    const order = cart.placeOrder();                  // domain enforces invariants
    await this.orders.save(order);                    // state + outbox in one txn
    await this.events.publish(order.pullEvents());    // e.g. grocery.order_placed
    return toResult(order);
  }
}
```

## Query (read) stub

```ts
@Injectable()
export class GetHomeFeedQueryHandler {
  constructor(private readonly readModel: HomeReadModelPort) {}
  async execute(q: { userId: string }) { return this.readModel.getHome(q.userId); } // from CQRS read model
}
```

## Rules checklist

- [ ] Depends on **ports**, never concrete adapters or other Skills.
- [ ] No HTTP/framework concerns (those are in the controller).
- [ ] Domain invariants enforced in entities, not here.
- [ ] Writes persist state **and** outbox events in one transaction ([ADR-0008](../docs/adr/adr-0008-event-driven-outbox.md)).
- [ ] Queries read from read models where applicable; no heavy joins on write tables.
- [ ] Errors are typed (`LifeOSError`); tool-facing failures returned as values where possible.

## Tests

- [ ] Unit tests with all ports mocked; assert domain interactions and emitted events.
- [ ] Idempotency test for non-idempotent commands.

## Definition of Done

- [ ] Handler covered ≥ 90% ([12](../docs/12_TESTING_GUIDE.md)).
- [ ] Events emitted and consumed correctly in integration.
- [ ] Docs + [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) updated.
