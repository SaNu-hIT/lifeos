/** DI token for the WorkflowEnginePort. */
export const WORKFLOW_ENGINE = Symbol('WORKFLOW_ENGINE');

export type WorkflowStatus = 'running' | 'completed' | 'failed';

export type WorkflowContext = Record<string, unknown>;

export interface WorkflowStep {
  name: string;
  /** Perform the step, mutating the shared context. Should be idempotent (a resumed
   *  run re-enters from the last incomplete step). */
  run(context: WorkflowContext): Promise<void>;
  /** Undo this step if a LATER step fails (compensation / rollback). */
  compensate?(context: WorkflowContext): Promise<void>;
}

export interface WorkflowDefinition {
  name: string;
  steps: WorkflowStep[];
}

export interface WorkflowRun {
  id: string;
  name: string;
  status: WorkflowStatus;
  stepIndex: number;
  context: WorkflowContext;
  error?: string;
}

export interface WorkflowEnginePort {
  register(definition: WorkflowDefinition): void;
  start(name: string, input?: WorkflowContext): Promise<{ runId: string }>;
  /** Advance a run to completion (or failure). Safe to call repeatedly (resumable). */
  execute(runId: string): Promise<WorkflowRun>;
  getRun(runId: string): Promise<WorkflowRun>;
}
