// Builds the Skill manifests this deployment installs. Kept separate from main.ts so it
// is unit-testable without booting Nest. Each Skill is a factory over its ports: a repo
// (in-memory here), a provider connector, an id factory, and a `publish` hook.

import { randomUUID } from 'node:crypto';
import type { DomainEvent, SkillManifest } from '@lifeos/contracts';
import { createGrocerySkill } from '@lifeos/skill-grocery';
import { createCalendarSkill } from '@lifeos/skill-calendar';
import { blinkitConnector } from '@lifeos/connector-blinkit';
import { googleCalendarConnector } from '@lifeos/connector-google-calendar';
import { InMemoryGroceryRepository } from './adapters/in-memory-grocery.repository.js';
import { InMemoryCalendarRepository } from './adapters/in-memory-calendar.repository.js';

export type Publish = (event: DomainEvent) => Promise<void>;

/** Grocery is served by Blinkit, Calendar by Google Calendar (connectors are swappable
 *  via the registry — see main.ts). `publish` drives the surface projections. */
export function buildManifests(publish: Publish): SkillManifest[] {
  const newId = (): string => randomUUID();
  return [
    createGrocerySkill({
      repository: new InMemoryGroceryRepository(),
      provider: blinkitConnector,
      newId,
      publish,
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
