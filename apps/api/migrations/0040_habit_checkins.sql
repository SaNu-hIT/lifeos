-- 0040_habit_checkins — per-day check-ins for the Habit skill. One row per (habit,
-- date) via the unique index — checking the same day twice corrects it, not duplicates
-- it (idempotent upsert, same pattern as wellness.cycle_entries). Deleting a habit
-- cascades its check-ins.

create table habit.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  habit_id uuid not null references habit.habits(id) on delete cascade,
  entry_date date not null,
  done boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  unique (habit_id, entry_date)
);
create index check_ins_user_date_idx on habit.check_ins (user_id, entry_date);

alter table habit.check_ins enable row level security;
alter table habit.check_ins force row level security;
create policy check_ins_owner on habit.check_ins
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on habit.check_ins to lifeos_app;
