import { Queue, type JobsOptions } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import type { DomainEvent } from '@lifeos/contracts';

export const EVENTS_QUEUE_NAME = 'lifeos-events';

const JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 200 },
  removeOnComplete: 1000,
  removeOnFail: false, // keep failed jobs as the dead-letter record
};

/** Parse a redis:// URL into ioredis options. `maxRetriesPerRequest: null` is
 *  required by BullMQ's blocking commands. BullMQ owns the resulting connections. */
export function redisConnection(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  };
}

/** Thin wrapper over the BullMQ events queue. */
export class EventQueue {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(EVENTS_QUEUE_NAME, { connection: redisConnection(redisUrl) });
  }

  async add(event: DomainEvent): Promise<void> {
    await this.queue.add('event', event, JOB_OPTIONS);
  }

  async counts(): Promise<Record<string, number>> {
    return this.queue.getJobCounts();
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
