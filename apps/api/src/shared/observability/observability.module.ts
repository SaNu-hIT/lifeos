import { Global, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotentDispatcher } from '../events/subscribers/idempotent-dispatcher.js';
import { MetricsRegistry } from './metrics.registry.js';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';
import { MetricsController } from './metrics.controller.js';
import { ReadinessController } from './readiness.controller.js';

/** Counts every dispatched domain event by type — the event side of the
 *  request→plan→tool→event observability path (docs/33). */
@Injectable()
class EventMetricsInitializer implements OnModuleInit {
  constructor(
    private readonly dispatcher: IdempotentDispatcher,
    private readonly metrics: MetricsRegistry,
  ) {}

  onModuleInit(): void {
    this.dispatcher.registerTap((event) =>
      this.metrics.increment('domain_events_total', { type: event.type }),
    );
  }
}

@Global()
@Module({
  controllers: [MetricsController, ReadinessController],
  providers: [
    MetricsRegistry,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    EventMetricsInitializer,
  ],
  exports: [MetricsRegistry],
})
export class ObservabilityModule {}
