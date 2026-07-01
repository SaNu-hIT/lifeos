import { Global, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { IdempotentDispatcher } from '../../shared/events/subscribers/idempotent-dispatcher.js';
import { RealtimeHub } from './realtime.hub.js';
import { RealtimeController } from './realtime.controller.js';

/** Taps the event dispatcher so every dispatched domain event is fanned out live to
 *  the owning user's connected clients (best-effort, ephemeral). */
@Injectable()
class RealtimeTapInitializer implements OnModuleInit {
  constructor(
    private readonly dispatcher: IdempotentDispatcher,
    private readonly hub: RealtimeHub,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerTap((event) => this.hub.publish(event));
  }
}

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeHub, RealtimeTapInitializer],
  exports: [RealtimeHub],
})
export class RealtimeModule {}
