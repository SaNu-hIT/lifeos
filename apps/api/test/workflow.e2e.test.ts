import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDatabaseAdapter } from '../src/shared/database/pg-database.adapter.js';
import { runMigrations } from '../src/shared/database/migrate.js';
import { WorkflowRunStore } from '../src/modules/workflow/adapters/out/workflow-run.store.js';
import { WorkflowEngine } from '../src/modules/workflow/workflow.engine.js';
import type { WorkflowDefinition } from '../src/modules/workflow/domain/ports/workflow.port.js';

const TEST_DB_URL = process.env.LIFEOS_TEST_DATABASE_URL ?? 'postgres://localhost:5432/lifeos_test';

describe('Phase 18 — workflow engine (integration)', () => {
  let db: PgDatabaseAdapter;
  let store: WorkflowRunStore;
  let engine: WorkflowEngine;

  beforeAll(async () => {
    await runMigrations(TEST_DB_URL);
    db = new PgDatabaseAdapter(TEST_DB_URL);
    store = new WorkflowRunStore(db);
    engine = new WorkflowEngine(store); // no queue → drive execute() directly
  });

  afterAll(async () => {
    await db.query("delete from platform.workflow_runs where name like 'test.%'");
    await db.close();
  });

  it('runs all steps to completion, accumulating context', async () => {
    const def: WorkflowDefinition = {
      name: 'test.happy',
      steps: [
        { name: 'a', run: async (c) => void (c.a = 1) },
        { name: 'b', run: async (c) => void (c.b = (c.a as number) + 1) },
      ],
    };
    engine.register(def);
    const { runId } = await engine.start('test.happy', {});
    const run = await engine.execute(runId);
    expect(run.status).toBe('completed');
    expect(run.context).toMatchObject({ a: 1, b: 2 });
    expect(run.stepIndex).toBe(2);
  });

  it('compensates completed steps in reverse when a later step fails', async () => {
    const order: string[] = [];
    const def: WorkflowDefinition = {
      name: 'test.rollback',
      steps: [
        { name: 's1', run: async () => void order.push('run:s1'), compensate: async () => void order.push('comp:s1') },
        { name: 's2', run: async () => void order.push('run:s2'), compensate: async () => void order.push('comp:s2') },
        {
          name: 's3',
          run: async () => {
            throw new Error('boom');
          },
        },
      ],
    };
    engine.register(def);
    const { runId } = await engine.start('test.rollback', {});
    const run = await engine.execute(runId);
    expect(run.status).toBe('failed');
    expect(run.error).toBe('boom');
    // s1, s2 ran; then rollback compensated s2, s1 in reverse.
    expect(order).toEqual(['run:s1', 'run:s2', 'comp:s2', 'comp:s1']);
  });

  it('resumes from the last incomplete step (does not re-run completed ones)', async () => {
    let s1Runs = 0;
    let s2Runs = 0;
    const def: WorkflowDefinition = {
      name: 'test.resume',
      steps: [
        { name: 's1', run: async () => void (s1Runs += 1) },
        { name: 's2', run: async () => void (s2Runs += 1) },
      ],
    };
    engine.register(def);
    const { runId } = await engine.start('test.resume', {});
    // Simulate a crash after step 0 committed.
    await store.update(runId, { stepIndex: 1 });
    const run = await engine.execute(runId);
    expect(run.status).toBe('completed');
    expect(s1Runs).toBe(0); // step 0 was already done — not re-run
    expect(s2Runs).toBe(1);
  });
});
