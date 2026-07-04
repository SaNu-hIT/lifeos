-- 0022_workout_sessions — schema + live session tracking for the Workout skill
-- (docs/02 §10, ADR-0001: schema owned by the Skill, not the platform core).
-- Sessions and sets are user-owned and RLS-scoped, same pattern as grocery.list_items
-- (0018). Only one active session per user is allowed at a time, enforced by a partial
-- unique index rather than application logic — the adapter catches the violation and
-- returns the existing active session instead of erroring (see docs/15 runbook).

create schema if not exists workout;
grant usage on schema workout to lifeos_app;

create table workout.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  status text not null check (status in ('active', 'finished', 'cancelled')),
  title text,
  notes text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sessions_user_idx on workout.sessions (user_id, started_at desc);
create unique index sessions_one_active_idx on workout.sessions (user_id) where status = 'active';

alter table workout.sessions enable row level security;
alter table workout.sessions force row level security;
create policy sessions_owner on workout.sessions
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on workout.sessions to lifeos_app;

-- exercise_name is always freeform text (the source of truth); exercise_id is a soft,
-- best-effort match against workout.exercise_catalog (0025) with no FK, since freeform
-- names that never match the catalog must still be loggable.
create table workout.sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout.sessions(id) on delete cascade,
  user_id uuid not null references platform.users(id),
  exercise_name text not null,
  exercise_name_normalized text not null,
  exercise_id text,
  set_number integer not null,
  weight_kg numeric(6, 2) not null default 0,
  reps integer not null,
  rpe numeric(3, 1),
  notes text,
  is_pr boolean not null default false,
  pr_kind text check (pr_kind in ('weight', 'volume', 'both')),
  created_at timestamptz not null default now()
);
create index sets_session_idx on workout.sets (session_id, created_at asc);
create index sets_user_exercise_idx on workout.sets (user_id, exercise_name_normalized, created_at desc);

alter table workout.sets enable row level security;
alter table workout.sets force row level security;
create policy sets_owner on workout.sets
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on workout.sets to lifeos_app;
