import type { DomainEvent } from '@lifeos/contracts';

/** DI token for the NotificationEnginePort. */
export const NOTIFICATION_ENGINE = Symbol('NOTIFICATION_ENGINE');
/** DI token for the array of NotificationChannel adapters. */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export type NotificationImportance = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationChannelName = 'in_app' | 'push' | 'email';

/** What a Skill/engine emits for one triggering event. Policy narrows channels. */
export interface NotificationIntent {
  userId: string;
  kind: string;
  title: string;
  body?: string;
  importance?: NotificationImportance;
  /** Channels the Skill *requests*; policy is authoritative on what actually sends. */
  channels?: NotificationChannelName[];
  deepLink?: string;
  /** Optional logical identity — suppresses duplicate notifications for the same thing. */
  dedupeKey?: string;
  occurredAt: string;
}

export interface NotificationView {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  importance: NotificationImportance;
  deepLink?: string;
  readAt?: string;
  occurredAt: string;
}

/** A Skill/engine-contributed declaration: turns a domain event into an intent.
 *  Return null to skip. Registered as an idempotent subscriber (exactly-once). */
export interface NotificationDeclaration {
  key: string;
  on: string; // domain event type
  build(event: DomainEvent): NotificationIntent | null;
}

export interface NotificationPage {
  data: NotificationView[];
  nextCursor?: string;
}

/** An outbound delivery channel (push, email, …). In-app is the inbox table itself. */
export interface NotificationChannel {
  readonly name: NotificationChannelName;
  deliver(notification: NotificationView): Promise<void>;
}

export interface NotificationEnginePort {
  registerDeclaration(declaration: NotificationDeclaration): void;
  getInbox(userId: string, page?: { limit?: number; cursor?: string }): Promise<NotificationPage>;
  markRead(userId: string, id: string): Promise<void>;
}
