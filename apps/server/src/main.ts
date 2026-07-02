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
  IdempotentDispatcher,
  loadAppConfig,
  SKILL_HOST,
  type SkillHost,
} from '@lifeos/api';
import { blinkitConnector } from '@lifeos/connector-blinkit';
import { zeptoConnector } from '@lifeos/connector-zepto';
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

  // Install the Skills through the single SkillHost seam.
  const host = app.get<SkillHost>(SKILL_HOST);
  await host.installAll(buildManifests(publish));

  // Register connectors so the registry can select/fail over and the console shows them.
  const connectors = app.get<ConnectorRegistryPort>(CONNECTOR_REGISTRY);
  for (const connector of [blinkitConnector, zeptoConnector, googleCalendarConnector]) {
    try {
      connectors.register(connector);
    } catch {
      // already registered (idempotent boot) — ignore
    }
  }

  app.enableShutdownHooks();
  await app.listen(config.PORT);
  // eslint-disable-next-line no-console
  console.log(`LifeOS composed server listening on :${config.PORT} (grocery + calendar installed)`);
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
