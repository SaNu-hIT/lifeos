import { Global, Module } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { DATABASE, type DatabasePort } from '../database/database.port.js';
import { EVENT_BUS } from './event-bus.port.js';
import { PgEventBus } from './pg-event-bus.js';
import { OutboxRepository } from './outbox/outbox.repository.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { DedupeStore } from './subscribers/dedupe.store.js';
import { SubscriberRegistry } from './subscribers/subscriber-registry.js';
import { IdempotentDispatcher } from './subscribers/idempotent-dispatcher.js';
import { EventQueue } from './bullmq/event-queue.js';
import { EventsRuntime } from './events.runtime.js';

@Global()
@Module({
  providers: [
    SubscriberRegistry,
    {
      provide: OutboxRepository,
      useFactory: (db: DatabasePort) => new OutboxRepository(db),
      inject: [DATABASE],
    },
    { provide: EVENT_BUS, useFactory: (repo: OutboxRepository) => new PgEventBus(repo), inject: [OutboxRepository] },
    { provide: DedupeStore, useFactory: (db: DatabasePort) => new DedupeStore(db), inject: [DATABASE] },
    { provide: EventQueue, useFactory: () => new EventQueue(loadAppConfig().REDIS_URL) },
    {
      provide: IdempotentDispatcher,
      useFactory: (registry: SubscriberRegistry, dedupe: DedupeStore) =>
        new IdempotentDispatcher(registry, dedupe),
      inject: [SubscriberRegistry, DedupeStore],
    },
    {
      provide: OutboxRelay,
      useFactory: (repo: OutboxRepository, queue: EventQueue) => new OutboxRelay(repo, queue),
      inject: [OutboxRepository, EventQueue],
    },
    EventsRuntime,
  ],
  exports: [EVENT_BUS, SubscriberRegistry, OutboxRelay, IdempotentDispatcher, EventQueue, OutboxRepository],
})
export class EventsModule {}
