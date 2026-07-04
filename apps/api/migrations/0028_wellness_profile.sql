-- 0028_wellness_profile — one-row-per-user tracking profile (goals, self-reported
-- average cycle length, and the supply list used for auto reminders), collected
-- before offering predictions/reminders to a user with no history yet (product
-- requirement: ask, don't guess — same pattern as workout.user_profile, 0024).

create table wellness.user_profile (
  user_id uuid primary key references platform.users(id),
  tracking_goals text[] not null default '{}',
  average_cycle_length_days integer,
  supply_list jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wellness.user_profile enable row level security;
alter table wellness.user_profile force row level security;
create policy user_profile_owner on wellness.user_profile
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on wellness.user_profile to lifeos_app;
