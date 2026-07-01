-- 0012_workflow_runs — durable state for the Workflow Engine (docs/02 §5).
-- System-level (a run may span Skills/users); accessed in service context, so no RLS.
-- step_index records progress so a run resumes after a crash without re-running
-- completed steps.

create table platform.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'running',   -- running | completed | failed
  step_index int not null default 0,
  context jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workflow_runs_status_idx on platform.workflow_runs (status) where status = 'running';

create trigger workflow_runs_set_updated_at
  before update on platform.workflow_runs
  for each row execute function platform.set_updated_at();

grant select, insert, update on platform.workflow_runs to lifeos_app;
