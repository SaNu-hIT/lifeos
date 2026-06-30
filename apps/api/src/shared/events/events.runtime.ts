import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { StructuredLogger } from '../logging/logger.js';
import { EventQueue } from './bullmq/event-queue.js';
import { EventWorker } from './bullmq/event-worker.js';
import { OutboxRelay } from './outbox/outbox-relay.js';
import { IdempotentDispatcher } from './subscribers/idempotent-dispatcher.js';

const RELAY_INTERVAL_MS = 1000;

/** Owns the live worker + relay loop. Starts on boot (except under test, where the
 *  relay/worker are driven manually for determinism) and tears down on shutdown. */
@Injectable()
export class EventsRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new StructuredLogger(loadAppConfig().LOG_LEVEL);
  private worker?: EventWorker;
  private interval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly relay: OutboxRelay,
    private readonly dispatcher: IdempotentDispatcher,
    private readonly queue: EventQueue,
  ) {}

  onApplicationBootstrap(): void {
    if (loadAppConfig().NODE_ENV === 'test') return; // tests start it explicitly
    this.start();
  }

  start(): void {
    this.worker = new EventWorker(loadAppConfig().REDIS_URL, (event) =>
      this.dispatcher.dispatch(event),
    );
    this.interval = setInterval(() => {
      this.relay.runOnce().catch((error: unknown) => {
        this.logger.error('outbox relay pass failed', { error: String(error) });
      });
    }, RELAY_INTERVAL_MS);
    this.logger.info('events runtime started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    if (this.worker) await this.worker.close();
    await this.queue.close();
  }
}
