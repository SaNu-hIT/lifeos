import type { DatabasePort } from '../../../../shared/database/database.port.js';
import type { WorkflowContext, WorkflowRun, WorkflowStatus } from '../../domain/ports/workflow.port.js';

interface RunRow {
  id: string;
  name: string;
  status: WorkflowStatus;
  step_index: number;
  context: WorkflowContext;
  error: string | null;
}

/** Durable store for workflow runs (service context — runs are system-level). */
export class WorkflowRunStore {
  constructor(private readonly db: DatabasePort) {}

  async create(name: string, input: WorkflowContext): Promise<string> {
    const r = await this.db.query<{ id: string }>(
      'insert into platform.workflow_runs (name, context) values ($1, $2) returning id',
      [name, JSON.stringify(input)],
    );
    return r.rows[0]!.id;
  }

  async load(runId: string): Promise<WorkflowRun> {
    const r = await this.db.query<RunRow>(
      'select id, name, status, step_index, context, error from platform.workflow_runs where id = $1',
      [runId],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`workflow run not found: ${runId}`);
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      stepIndex: row.step_index,
      context: row.context,
      error: row.error ?? undefined,
    };
  }

  async update(
    runId: string,
    patch: { status?: WorkflowStatus; stepIndex?: number; context?: WorkflowContext; error?: string | null },
  ): Promise<void> {
    await this.db.query(
      `update platform.workflow_runs set
         status = coalesce($2, status),
         step_index = coalesce($3, step_index),
         context = coalesce($4, context),
         error = $5
       where id = $1`,
      [
        runId,
        patch.status ?? null,
        patch.stepIndex ?? null,
        patch.context ? JSON.stringify(patch.context) : null,
        patch.error ?? null,
      ],
    );
  }

  async listRunning(limit = 100): Promise<string[]> {
    const r = await this.db.query<{ id: string }>(
      "select id from platform.workflow_runs where status = 'running' order by created_at limit $1",
      [limit],
    );
    return r.rows.map((x) => x.id);
  }
}
