// LifeOS composed server — the deployable entrypoint. It boots the platform core
// (apps/api) and installs the shipped Skills + Connectors. This is the ONLY place that
// knows concrete Skills exist; the core stays skill-agnostic (ADR-0001).

import 'reflect-metadata';
import { pathToFileURL } from 'node:url';
import {
  CONNECTOR_REGISTRY,
  type ConnectorRegistryPort,
  type DomainEvent,
} from '@lifeos/contracts';
import {
  createApp,
  DATABASE,
  IdempotentDispatcher,
  loadAppConfig,
  SKILL_HOST,
  type DatabasePort,
  type SkillHost,
} from '@lifeos/api';
import { createAllQuickCommerceConnectors } from '@lifeos/connector-quick-commerce';
import { googleCalendarConnector } from '@lifeos/connector-google-calendar';
import { buildManifests } from './skills.js';

export async function bootstrap(): Promise<void> {
  const config = loadAppConfig();
  const app = await createApp();

  // Skill `publish` → the in-process idempotent dispatcher, so surface projections
  // (activity/notification) fire immediately. (The durable outbox path — EVENT_BUS in a
  // txn + relay — is the production route; this keeps the dev demo synchronous.)
  const dispatcher = app.get(IdempotentDispatcher);
  const publish = (event: DomainEvent): Promise<void> => dispatcher.dispatch(event);

  // Register connectors so the registry can select/fail over and the console shows them.
  // The six quick-commerce connectors (Blinkit, Zepto, Instamart, BigBasket, JioMart,
  // Flipkart Minutes) are real reverse-engineered JSON-API price scrapers; compare_prices/
  // check_price (skills/grocery/src/tools.ts) fan out over every registered grocery
  // connector, so each shows up as its own column. A connector without credentials reports
  // unhealthy and the comparison falls back to cache rather than failing.
  const connectors = app.get<ConnectorRegistryPort>(CONNECTOR_REGISTRY);
  for (const connector of [...createAllQuickCommerceConnectors(), googleCalendarConnector]) {
    try {
      connectors.register(connector);
    } catch {
      // already registered (idempotent boot) — ignore
    }
  }

  // Install the Skills through the single SkillHost seam.
  const db = app.get<DatabasePort>(DATABASE);
  const host = app.get<SkillHost>(SKILL_HOST);
  const manifests = buildManifests(publish, { db, connectors, upgradeUrl: config.UPGRADE_URL });
  await host.installAll(manifests);

  app.enableShutdownHooks();
  await app.listen(config.PORT);
  const skillKeys = manifests.map((m) => m.key).join(' + ');
  // eslint-disable-next-line no-console
  console.log(`LifeOS composed server listening on :${config.PORT} (${skillKeys} installed)`);
}

// Auto-start only when this file is the process entry point (not when imported).
const isEntry =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  bootstrap().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
