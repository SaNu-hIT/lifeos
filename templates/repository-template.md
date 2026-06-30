---
title: Repository Template
status: Authoritative
version: 1.0.0
type: template
---

# Repository Template (Outbound Adapter)

> Copy this for a persistence **repository** — the outbound adapter that implements a domain repository port. SQL/Supabase lives here and **only** here. The domain never sees it.

References: [09 Database](../docs/09_DATABASE_DESIGN.md) · [ADR-0003](../docs/adr/adr-0003-hexagonal-ddd.md) · [ADR-0010](../docs/adr/adr-0010-supabase-baas.md)

## Port (in domain) + adapter (in adapters/out)

```ts
// domain/ports/order-repository.port.ts
export interface OrderRepositoryPort {
  getCart(userId: string, cartId: string): Promise<Cart>;
  save(order: Order): Promise<void>;     // persists state + outbox atomically
}

// adapters/out/order.repository.ts
@Injectable()
export class PgOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: DatabasePort) {}

  async save(order: Order): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.upsert('grocery.orders', toRow(order));
      for (const e of order.pullEvents()) {
        await tx.insert('platform.outbox', toOutboxRow(e));   // same txn
      }
    });
  }

  async getCart(userId, cartId) {
    const row = await this.db.queryOne('grocery.carts', { user_id: userId, id: cartId });
    return toDomain(row);   // map row → domain entity
  }
}
```

## Rules checklist

- [ ] Implements a domain **port**; returns **domain entities**, never raw rows.
- [ ] All SQL/Supabase calls confined here (`adapters/out`).
- [ ] Mapping `row ↔ domain` in dedicated mappers; `snake_case` (DB) ↔ `camelCase` (domain).
- [ ] State changes that emit events write the **outbox row in the same transaction** ([ADR-0008](../docs/adr/adr-0008-event-driven-outbox.md)).
- [ ] Relies on **RLS**; never bypasses tenant scoping ([09 §4](../docs/09_DATABASE_DESIGN.md)).
- [ ] Keyset pagination for lists ([10 §4](../docs/10_API_STANDARD.md)).

## Tests

- [ ] Integration tests against real Postgres (testcontainers, migrations applied).
- [ ] RLS test: a query cannot read another user's rows.
- [ ] Mapper round-trip tests.

## Definition of Done

- [ ] Port fully implemented and covered.
- [ ] Migration added & numbered; [09](../docs/09_DATABASE_DESIGN.md) + DB version in [06](../docs/06_PROJECT_STATE.md) updated.
- [ ] Tests green.

## Future extension points

- Swap Postgres adapter for a different store without touching the port (service extraction / vector store).
