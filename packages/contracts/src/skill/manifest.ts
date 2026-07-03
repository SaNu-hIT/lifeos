// The declarative description a Skill registers with — the core never imports a
// Skill; it reads manifests (docs/02 §10, docs/adr/adr-0001-modular-monolith.md).

import type { CapabilityKey } from '../permission/capability.js';
import type { Tool } from '../tool/tool.js';
import type { JSONSchema } from '../tool/json-schema.js';
import type { ContextProvider } from '../context/context.js';
import type { EventHandler } from '../event/event.js';
import type {
  ActivityProjection,
  NotificationDeclaration,
  WidgetContribution,
} from './contributions.js';

export interface CapabilityDeclaration {
  key: CapabilityKey;
  description: string;
}

export interface EventHandlerRegistration {
  event: string;
  handler: EventHandler;
}

export interface SkillManifest {
  key: string;
  version: string;
  /** Human-readable name for surfaces (console, skills list), e.g. "Grocery". Falls
   *  back to `key` when absent. */
  title?: string;
  /** One-line description of what the Skill does, shown alongside the title. */
  description?: string;
  /** The platform contract version this Skill targets (semver range). */
  contractVersion: string;
  capabilities: CapabilityDeclaration[];
  tools: Tool[];
  contextProviders?: ContextProvider[];
  /** Home widgets contributed to the dynamic home (phase 21). */
  widgets?: WidgetContribution[];
  /** Notification intents triggered by domain events (phase 20). */
  notifications?: NotificationDeclaration[];
  /** Activity-feed projections from domain events (phase 19). */
  activityProjections?: ActivityProjection[];
  eventHandlers?: EventHandlerRegistration[];
  configSchema?: JSONSchema;
}
