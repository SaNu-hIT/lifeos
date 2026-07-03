// Builds the Skill manifests this deployment installs. Kept separate from main.ts so it
// is unit-testable without booting Nest. Each Skill is a factory over its ports: a repo
// (in-memory here), a provider connector, an id factory, and a `publish` hook.

import { randomUUID } from 'node:crypto';
import type { ConnectorRegistryPort, DomainEvent, SkillManifest } from '@lifeos/contracts';
import type { DatabasePort } from '@lifeos/api';
import { createGrocerySkill } from '@lifeos/skill-grocery';
import { createCalendarSkill } from '@lifeos/skill-calendar';
import { blinkitConnector } from '@lifeos/connector-blinkit';
import { googleCalendarConnector } from '@lifeos/connector-google-calendar';
import { InMemoryGroceryRepository } from './adapters/in-memory-grocery.repository.js';
import { InMemoryCalendarRepository } from './adapters/in-memory-calendar.repository.js';
import { PgGroceryListRepository } from './adapters/pg-grocery-list.repository.js';
import { PgGroceryPriceCacheAdapter } from './adapters/pg-grocery-price-cache.adapter.js';
import { PgGroceryPreferenceAdapter } from './adapters/pg-grocery-preference.adapter.js';

export type Publish = (event: DomainEvent) => Promise<void>;

export interface BuildManifestsDeps {
  db: DatabasePort;
  /** The live Connector Registry — grocery.compare_prices fans out across every
   *  connector registered under the 'grocery' domain (Blinkit, Zepto, live Blinkit).
   *  Passing the registry itself (not a snapshot) is safe: connectors are registered
   *  into it separately in main.ts, and compare_prices reads it lazily per request. */
  connectors: ConnectorRegistryPort;
}

/** Grocery is served by Blinkit, Calendar by Google Calendar (connectors are swappable
 *  via the registry — see main.ts). `publish` drives the surface projections. */
export function buildManifests(publish: Publish, deps: BuildManifestsDeps): SkillManifest[] {
  const newId = (): string => randomUUID();
  return [
    createGrocerySkill({
      repository: new InMemoryGroceryRepository(),
      provider: blinkitConnector,
      list: new PgGroceryListRepository(deps.db),
      priceCache: new PgGroceryPriceCacheAdapter(deps.db),
      preferences: new PgGroceryPreferenceAdapter(deps.db),
      connectors: deps.connectors,
      newId,
      publish,
      // Live browser scrapes take ~6-8s per store; give the per-store cap headroom so
      // Blinkit/Zepto don't get cut off before returning (falls back to cache on timeout).
      compareTimeoutMs: 15000,
    }),
    createCalendarSkill({
      repository: new InMemoryCalendarRepository(),
      provider: googleCalendarConnector,
      newId,
      publish,
      now: () => new Date().toISOString(),
    }),
  ];
}
