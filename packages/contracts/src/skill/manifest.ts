// The declarative description a Skill registers with — the core never imports a
// Skill; it reads manifests (docs/02 §10, docs/adr/adr-0001-modular-monolith.md).

import type { CapabilityKey } from '../permission/capability.js';
import type { Tool } from '../tool/tool.js';
import type { JSONSchema } from '../tool/json-schema.js';
import type { ContextProvider } from '../context/context.js';
import type { EventHandler } from '../event/event.js';

export interface CapabilityDeclaration {
  key: CapabilityKey;
  description: string;
}

export interface WidgetContribution {
  key: string;
  requiredCapability: CapabilityKey;
}

export interface NotificationDeclaration {
  key: string;
  /** Domain event type that triggers this notification. */
  on: string;
  requiredCapability: CapabilityKey;
}

export interface EventHandlerRegistration {
  event: string;
  handler: EventHandler;
}

export interface SkillManifest {
  key: string;
  version: string;
  /** The platform contract version this Skill targets (semver range). */
  contractVersion: string;
  capabilities: CapabilityDeclaration[];
  tools: Tool[];
  contextProviders?: ContextProvider[];
  widgets?: WidgetContribution[];
  notifications?: NotificationDeclaration[];
  eventHandlers?: EventHandlerRegistration[];
  configSchema?: JSONSchema;
}
