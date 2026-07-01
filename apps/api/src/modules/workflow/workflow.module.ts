import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { loadAppConfig } from '../../config/app-config.js';
import { DATABASE, type DatabasePort } from '../../shared/database/database.port.js';
import { WORKFLOW_ENGINE } from './domain/ports/workflow.port.js';
import { WorkflowRunStore } from './adapters/out/workflow-run.store.js';
import { WorkflowEngine } from './workflow.engine.js';
import { WorkflowQueue, WorkflowWorker } from './bullmq/workflow-queue.js';

/** Runs the BullMQ worker that advances workflow runs, and resumes any 'running'
 *  runs on boot (crash recovery). Skipped under test (runs are driven directly). */
@Injectable()
class WorkflowRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private worker?: WorkflowWorker;

  constructor(
    @Inject(WORKFLOW_ENGINE) private readonly engine: WorkflowEngine,
    private readonly store: WorkflowRunStore,
    private readonly queue: WorkflowQueue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (loadAppConfig().NODE_ENV === 'test') return;
    this.worker = new WorkflowWorker(loadAppConfig().REDIS_URL, (runId) =>
      this.engine.execute(runId).then(() => undefined),
    );
    // Crash recovery: re-enqueue runs that were mid-flight.
    for (const runId of await this.store.listRunning()) await this.queue.enqueue(runId);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) await this.worker.close();
    await this.queue.close();
  }
}

@Global()
@Module({
  providers: [
    { provide: WorkflowRunStore, useFactory: (db: DatabasePort) => new WorkflowRunStore(db), inject: [DATABASE] },
    { provide: WorkflowQueue, useFactory: () => new WorkflowQueue(loadAppConfig().REDIS_URL) },
    {
      provide: WORKFLOW_ENGINE,
      useFactory: (store: WorkflowRunStore, queue: WorkflowQueue) => new WorkflowEngine(store, queue),
      inject: [WorkflowRunStore, WorkflowQueue],
    },
    WorkflowRuntime,
  ],
  exports: [WORKFLOW_ENGINE],
})
export class WorkflowModule {}
