---
title: Connector Template
status: Authoritative
version: 1.0.0
type: template
---

# Connector Template

> Copy this to build a new **Connector** — an adapter that implements a Provider SDK port for one external provider (Blinkit, Zepto, Amazon, …). A Skill never knows which connector runs. A connector is "correct" iff it passes the Provider SDK contract test suite.

References: [02 §12](../docs/02_LifeOS_Platform_Architecture.md) · [ADR-0005](../docs/adr/adr-0005-provider-sdk.md) · [11 Security](../docs/11_SECURITY_GUIDE.md)

## Folder structure

```
connectors/<connector>/
├── src/
│   ├── <connector>.connector.ts     # implements the Provider SDK port
│   ├── <connector>.manifest.ts      # registration (domain, key, health, config)
│   ├── client/                      # vendor HTTP client (rate limits, retries)
│   ├── mappers/                     # vendor DTO <-> domain model
│   └── config/                      # config schema (scoped credentials)
└── test/
    ├── contract/                    # runProviderContractTests(<connector>)
    └── fixtures/                    # recorded, sanitized vendor responses
```

## Implementation stub

```ts
import { GroceryProviderPort } from '@lifeos/provider-sdk';

export class <Connector>Connector implements GroceryProviderPort {
  constructor(private readonly client: <Connector>Client) {}

  async searchProducts(query, ctx) { /* map domain → vendor → domain */ }
  async createCart(items, ctx) { /* ... */ }
  async placeOrder(cartId, ctx) { /* ... */ }
  async health() { /* return ProviderHealth */ }
}
```

## Manifest

```ts
import { defineConnector } from '@lifeos/provider-sdk';

export default defineConnector({
  key: '<connector>',          // 'zepto'
  domain: 'grocery',           // which provider port it implements
  configSchema: <connector>ConfigSchema,
  selectionHints: { regions: ['IN'], strengths: ['speed'] }, // policy inputs
});
```

## Rules checklist

- [ ] Implements the domain **port** exactly; exposes **no** vendor-specific types upward.
- [ ] Credentials come from config/secret manager, **scoped to this connector**, never logged ([11 §4](../docs/11_SECURITY_GUIDE.md)).
- [ ] Has rate limiting, timeouts, retries (idempotent only), and a circuit breaker.
- [ ] `health()` implemented for failover.
- [ ] No business logic — only mapping + transport. Logic lives in the Skill.

## Tests

- [ ] `runProviderContractTests(<connector>)` passes against recorded fixtures (offline; no live vendor calls in CI).
- [ ] Mapper unit tests (vendor DTO ↔ domain).
- [ ] Failure-mode tests (timeout, 5xx, rate limit → circuit breaker).

## Definition of Done

- [ ] Registers in Connector Registry; selectable by policy; fails over correctly.
- [ ] Contract suite green; fixtures committed (sanitized).
- [ ] Docs + [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) updated.

## Future extension points

- Marketplace/self-serve provider onboarding (partner ships a connector passing the suite).
- Cost/latency telemetry feeding the selection policy.
