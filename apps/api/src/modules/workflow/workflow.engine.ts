import type {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowEnginePort,
  WorkflowRun,
} from './domain/ports/workflow.port.js';
import type { WorkflowRunStore } from './adapters/out/workflow-run.store.js';

export interface WorkflowQueuePort {
  enqueue(runId: string): Promise<void>;
}

/**
 * Durable, resumable multi-step execution (a saga). Progress (step_index) is persisted
 * after each step, so a crash resumes from the last incomplete step without re-running
 * completed ones. If a step fails, previously-completed steps are compensated in reverse
 * (rollback). See docs/02 §5 and the workflow template.
 */
export class WorkflowEngine implements WorkflowEnginePort {
  private readonly definitions = new Map<string, WorkflowDefinition>();

  constructor(
    private readonly store: WorkflowRunStore,
    private readonly queue?: WorkflowQueuePort,
  ) {}

  register(definition: WorkflowDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  async start(name: string, input: WorkflowContext = {}): Promise<{ runId: string }> {
    if (!this.definitions.has(name)) throw new Error(`unknown workflow: ${name}`);
    const runId = await this.store.create(name, input);
    if (this.queue) await this.queue.enqueue(runId);
    return { runId };
  }

  getRun(runId: string): Promise<WorkflowRun> {
    return this.store.load(runId);
  }

  async execute(runId: string): Promise<WorkflowRun> {
    const run = await this.store.load(runId);
    if (run.status !== 'running') return run;
    const definition = this.definitions.get(run.name);
    if (!definition) throw new Error(`unknown workflow: ${run.name}`);

    const context = run.context;
    for (let i = run.stepIndex; i < definition.steps.length; i += 1) {
      const step = definition.steps[i]!;
      try {
        await step.run(context);
      } catch (error) {
        // Roll back completed steps in reverse.
        for (let j = i - 1; j >= 0; j -= 1) {
          await definition.steps[j]!.compensate?.(context);
        }
        await this.store.update(runId, {
          status: 'failed',
          context,
          error: (error as Error).message,
        });
        return this.store.load(runId);
      }
      // Persist progress after each successful step (durability / resume point).
      await this.store.update(runId, { stepIndex: i + 1, context });
    }

    await this.store.update(runId, { status: 'completed', context });
    return this.store.load(runId);
  }
}
