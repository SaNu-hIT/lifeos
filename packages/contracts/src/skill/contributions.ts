// The runtime contribution surface a Skill plugs into (docs/02 §15). These are the
// canonical shapes the platform engines install at boot — Activity (phase 19),
// Notification (phase 20), Home widgets (phase 21). They are plain data + pure build
// functions over events/context, so a Skill authors them without importing the core
// (docs/adr/adr-0001-modular-monolith.md).

import type { CapabilityKey } from '../permission/capability.js';
import type { DomainEvent } from '../event/event.js';

// ── Activity feed ──────────────────────────────────────────────────────────────
export interface ActivityEntry {
  userId: string;
  kind: string;
  title: string;
  summary?: string;
  deepLink?: string;
  /** ISO-8601 timestamp. */
  occurredAt: string;
}

/** Turns a domain event into a feed entry (return null to skip). Installed as an
 *  idempotent subscriber, so at-least-once delivery yields exactly one entry. */
export interface ActivityProjection {
  key: string;
  /** Domain event type that feeds this projection. */
  on: string;
  build(event: DomainEvent): ActivityEntry | null;
}

// ── Notifications ────────────────────────────────────────────────────────────
export type NotificationImportance = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationChannelName = 'in_app' | 'push' | 'email';

export interface NotificationIntent {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  importance?: NotificationImportance;
  /** Channels the Skill requests; platform policy is authoritative on delivery. */
  channels?: NotificationChannelName[];
  deepLink?: string;
  /** Optional logical identity — suppresses duplicate notifications for one thing. */
  dedupeKey?: string;
  /** ISO-8601 timestamp. */
  occurredAt: string;
}

/** Turns a domain event into a notification intent (return null to skip). Installed
 *  as an idempotent subscriber (exactly-once). */
export interface NotificationDeclaration {
  key: string;
  /** Domain event type that triggers this notification. */
  on: string;
  build(event: DomainEvent): NotificationIntent | null;
}

// ── Home widgets ─────────────────────────────────────────────────────────────
export interface WidgetData {
  /** Optional 0..1 urgency signal; boosts ranking above base priority. */
  urgency?: number;
  /** Optional freshness marker for the client (ISO-8601). */
  asOf?: string;
  /** Arbitrary render payload consumed by the UI. */
  props: Record<string, unknown>;
}

export interface WidgetContext {
  userId: string;
}

/** A widget the home assembles at request time. Hidden when the user lacks
 *  `requiredCapability`; `build` reads from read models (null renders nothing). */
export interface WidgetContribution {
  key: string;
  title: string;
  requiredCapability?: CapabilityKey;
  /** Base ordering weight (higher = earlier); overridable per user. */
  priority: number;
  build(ctx: WidgetContext): Promise<WidgetData | null>;
}
