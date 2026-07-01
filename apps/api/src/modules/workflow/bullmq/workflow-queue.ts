import { Queue, Worker, type JobsOptions } from 'bullmq';
import { redisConnection } from '../../../shared/events/bullmq/event-queue.js';
import type { WorkflowQueuePort } from '../workflow.engine.js';

export const WORKFLOW_QUEUE_NAME = 'lifeos-workflows';

const JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 500 },
  removeOnComplete: 1000,
  removeOnFail: false,
};

/** Enqueues workflow-run advancement jobs onto BullMQ. */
export class WorkflowQueue implements WorkflowQueuePort {
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.queue = new Queue(WORKFLOW_QUEUE_NAME, { connection: redisConnection(redisUrl) });
  }

  async enqueue(runId: string): Promise<void> {
    await this.queue.add('advance', { runId }, JOB_OPTIONS);
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}

/** Consumes workflow jobs and advances each run to completion/failure. */
export class WorkflowWorker {
  private readonly worker: Worker;

  constructor(redisUrl: string, advance: (runId: string) => Promise<void>) {
    this.worker = new Worker(
      WORKFLOW_QUEUE_NAME,
      async (job) => {
        await advance((job.data as { runId: string }).runId);
      },
      { connection: redisConnection(redisUrl), concurrency: 1 },
    );
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
