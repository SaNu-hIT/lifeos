import { Global, Module } from '@nestjs/common';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { SubscriberRegistry } from '../../shared/events/subscribers/subscriber-registry.js';
import { ACTIVITY_ENGINE } from './domain/ports/activity.port.js';
import { ActivityRepository } from './adapters/out/activity.repository.js';
import { ActivityEngine } from './activity.engine.js';
import { ActivityController } from './adapters/in/activity.controller.js';

@Global()
@Module({
  controllers: [ActivityController],
  providers: [
    { provide: ActivityRepository, useFactory: (db: DatabasePort) => new ActivityRepository(db), inject: [DATABASE] },
    {
      provide: ACTIVITY_ENGINE,
      useFactory: (repo: ActivityRepository, subs: SubscriberRegistry) =>
        new ActivityEngine(repo, subs),
      inject: [ActivityRepository, SubscriberRegistry],
    },
  ],
  exports: [ACTIVITY_ENGINE],
})
export class ActivityModule {}
