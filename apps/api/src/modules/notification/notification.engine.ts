import type { SubscriberRegistry } from '../../shared/events/subscribers/subscriber-registry.js';
import type { NotificationPolicy } from './domain/notification.policy.js';
import type {
  NotificationChannel,
  NotificationChannelName,
  NotificationEnginePort,
  NotificationDeclaration,
  NotificationIntent,
  NotificationPage,
  NotificationView,
} from './domain/ports/notification.port.js';
import type { NotificationRepository } from './adapters/out/notification.repository.js';

const DEFAULT_LIMIT = 50;

/**
 * Turns declared intents into delivered notifications (docs/02 §15). Skills DECLARE;
 * the engine decides. Each declaration is a NAMED subscriber, so the idempotent
 * dispatcher (phase-06) gives exactly-once effect despite at-least-once delivery;
 * the in-app inbox persists always, external channels fire per policy.
 */
export class NotificationEngine implements NotificationEnginePort {
  private readonly channelsByName: Map<NotificationChannelName, NotificationChannel>;

  constructor(
    private readonly repo: NotificationRepository,
    private readonly subscribers: SubscriberRegistry,
    private readonly policy: NotificationPolicy,
    channels: NotificationChannel[],
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.channelsByName = new Map(channels.map((c) => [c.name, c]));
  }

  registerDeclaration(declaration: NotificationDeclaration): void {
    this.subscribers.on(declaration.on, `notification:${declaration.key}`, async (event) => {
      const intent = declaration.build(event);
      if (intent) await this.deliver(intent);
    });
  }

  /** Persist to the inbox and fan out to policy-selected external channels.
   *  Returns null when a duplicate `dedupeKey` suppressed the notification. */
  async deliver(intent: NotificationIntent): Promise<NotificationView | null> {
    const external = this.policy.resolveExternalChannels(intent, this.clock());
    const view = await this.repo.insert(intent, external);
    if (!view) return null; // deduped — do not re-deliver to external channels
    await Promise.all(
      external.map((name) => this.channelsByName.get(name)?.deliver(view) ?? Promise.resolve()),
    );
    return view;
  }

  getInbox(userId: string, page?: { limit?: number; cursor?: string }): Promise<NotificationPage> {
    return this.repo.inbox(userId, Math.min(page?.limit ?? DEFAULT_LIMIT, 100), page?.cursor);
  }

  markRead(userId: string, id: string): Promise<void> {
    return this.repo.markRead(userId, id);
  }
}
