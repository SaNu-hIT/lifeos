-- 0023_workout_prs — materialized personal records, one row per (user, exercise).
-- Updated transactionally alongside each set insert (not computed on read) so
-- workout.get_exercise_history and the "days since trained" context check stay cheap
-- single-row reads instead of scanning full set history every turn.

create table workout.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  exercise_name_normalized text not null,
  best_weight_kg numeric(6, 2) not null,
  best_weight_reps integer not null,
  best_volume numeric(8, 2) not null,
  best_volume_set_weight_kg numeric(6, 2) not null,
  best_volume_set_reps integer not null,
  achieved_at timestamptz not null default now(),
  source_set_id uuid not null references workout.sets(id),
  unique (user_id, exercise_name_normalized)
);
create index prs_user_idx on workout.personal_records (user_id);

alter table workout.personal_records enable row level security;
alter table workout.personal_records force row level security;
create policy prs_owner on workout.personal_records
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on workout.personal_records to lifeos_app;
