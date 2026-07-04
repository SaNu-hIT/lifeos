-- 0027_wellness_cycle_entries — schema + per-day cycle logging for the Wellness
-- skill (docs/02 §10, ADR-0001: schema owned by the Skill, not the platform core).
-- One row per (user, date) — logging the same date twice corrects it, not duplicates
-- it (see wellness.log_day). Cycles are derived at read time from consecutive
-- flow-logged days, not stored as their own entity.

create schema if not exists wellness;
grant usage on schema wellness to lifeos_app;

create table wellness.cycle_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  entry_date date not null,
  flow text check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}',
  basal_body_temp_c numeric(4, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
create index cycle_entries_user_date_idx on wellness.cycle_entries (user_id, entry_date);

alter table wellness.cycle_entries enable row level security;
alter table wellness.cycle_entries force row level security;
create policy cycle_entries_owner on wellness.cycle_entries
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on wellness.cycle_entries to lifeos_app;
