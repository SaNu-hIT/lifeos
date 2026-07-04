-- 0039_habit_habits — schema + habit definitions for the Habit skill (docs/02 §10,
-- ADR-0001: schema owned by the Skill). Config (frequency, reminder time) lives on the
-- habit row itself, so there is no separate profile table. Streaks are derived at read
-- time from check-ins (0040), not stored — mirroring how Wellness derives cycles.

create schema if not exists habit;
grant usage on schema habit to lifeos_app;

create table habit.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  name text not null,
  frequency text not null check (frequency in ('daily', 'weekdays', 'weekly')),
  reminder_time time,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_active_idx on habit.habits (user_id, active);

alter table habit.habits enable row level security;
alter table habit.habits force row level security;
create policy habits_owner on habit.habits
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on habit.habits to lifeos_app;
