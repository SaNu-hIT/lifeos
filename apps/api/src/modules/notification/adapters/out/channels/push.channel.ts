import type {
  NotificationChannel,
  NotificationChannelName,
  NotificationView,
} from '../../../domain/ports/notification.port.js';

/**
 * Stub push channel. A real adapter (APNs/FCM behind a Provider SDK connector,
 * ADR-0005) drops in here later without touching the engine or Skills.
 */
export class PushChannel implements NotificationChannel {
  readonly name: NotificationChannelName = 'push';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deliver(_notification: NotificationView): Promise<void> {
    // No-op until a real push connector is configured (deferred infra).
  }
}
