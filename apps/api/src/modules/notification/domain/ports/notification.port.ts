import type {
  NotificationChannelName,
  NotificationDeclaration,
  NotificationImportance,
  NotificationIntent,
} from '@lifeos/contracts';

export type {
  NotificationChannelName,
  NotificationDeclaration,
  NotificationImportance,
  NotificationIntent,
};

/** DI token for the NotificationEnginePort. */
export const NOTIFICATION_ENGINE = Symbol('NOTIFICATION_ENGINE');
/** DI token for the array of NotificationChannel adapters. */
export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

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
