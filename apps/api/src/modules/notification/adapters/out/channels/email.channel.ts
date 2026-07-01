import type {
  NotificationChannel,
  NotificationChannelName,
  NotificationView,
} from '../../../domain/ports/notification.port.js';

/**
 * Stub email channel. A real adapter (SES/Resend behind a Provider SDK connector,
 * ADR-0005) drops in here later without touching the engine or Skills.
 */
export class EmailChannel implements NotificationChannel {
  readonly name: NotificationChannelName = 'email';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deliver(_notification: NotificationView): Promise<void> {
    // No-op until a real email connector is configured (deferred infra).
  }
}
