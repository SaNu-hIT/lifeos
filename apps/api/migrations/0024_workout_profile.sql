-- 0024_workout_profile — one-row-per-user onboarding profile (frequency, goals,
-- experience, equipment), collected before suggesting a workout to a user with no
-- history yet (product requirement: ask, don't guess).

create table workout.user_profile (
  user_id uuid primary key references platform.users(id),
  frequency_per_week integer not null,
  goals text[] not null default '{}',
  experience text not null check (experience in ('beginner', 'intermediate', 'advanced')),
  available_equipment text[] not null default '{}',
  preferred_duration_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workout.user_profile enable row level security;
alter table workout.user_profile force row level security;
create policy user_profile_owner on workout.user_profile
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on workout.user_profile to lifeos_app;
