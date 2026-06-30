import { Worker } from 'bullmq';
import type { DomainEvent } from '@lifeos/contracts';
import { EVENTS_QUEUE_NAME, redisConnection } from './event-queue.js';

/** Consumes queued events and hands them to the dispatcher. Failed jobs retry with
 *  backoff (per queue options) and are retained as dead-letters after max attempts. */
export class EventWorker {
  private readonly worker: Worker;

  constructor(redisUrl: string, dispatch: (event: DomainEvent) => Promise<void>) {
    this.worker = new Worker(
      EVENTS_QUEUE_NAME,
      async (job) => {
        await dispatch(job.data as DomainEvent);
      },
      { connection: redisConnection(redisUrl), concurrency: 1 },
    );
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
