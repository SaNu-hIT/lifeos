import { Global, Module } from '@nestjs/common';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { SubscriberRegistry } from '../../shared/events/subscribers/subscriber-registry.js';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ENGINE,
  type NotificationChannel,
} from './domain/ports/notification.port.js';
import { NotificationPolicy } from './domain/notification.policy.js';
import { NotificationRepository } from './adapters/out/notification.repository.js';
import { PushChannel } from './adapters/out/channels/push.channel.js';
import { EmailChannel } from './adapters/out/channels/email.channel.js';
import { NotificationEngine } from './notification.engine.js';
import { NotificationController } from './adapters/in/notification.controller.js';

@Global()
@Module({
  controllers: [NotificationController],
  providers: [
    {
      provide: NotificationRepository,
      useFactory: (db: DatabasePort) => new NotificationRepository(db),
      inject: [DATABASE],
    },
    // Stub channels today; real push/email connectors (ADR-0005) drop in here.
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (): NotificationChannel[] => [new PushChannel(), new EmailChannel()],
    },
    {
      provide: NOTIFICATION_ENGINE,
      useFactory: (
        repo: NotificationRepository,
        subs: SubscriberRegistry,
        channels: NotificationChannel[],
      ) => new NotificationEngine(repo, subs, new NotificationPolicy(), channels),
      inject: [NotificationRepository, SubscriberRegistry, NOTIFICATION_CHANNELS],
    },
  ],
  exports: [NOTIFICATION_ENGINE],
})
export class NotificationModule {}
