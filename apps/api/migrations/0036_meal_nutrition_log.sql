-- 0036_meal_nutrition_log — per-food nutrition logging for the Meal Planning skill.
-- Calories/macros are optional (nullable) — the user may log a food without macros,
-- or they can be filled from the seeded food catalog (0037) at log time. Unlike
-- planned_meals, this is a historical append-only log (what was actually eaten).

create table meal_planning.nutrition_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  entry_date date not null,
  slot text check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  food_id text,
  servings numeric(6, 2) not null default 1,
  calories numeric(8, 2),
  protein_g numeric(7, 2),
  carbs_g numeric(7, 2),
  fat_g numeric(7, 2),
  logged_at timestamptz not null default now()
);
create index nutrition_log_user_date_idx on meal_planning.nutrition_log (user_id, entry_date);

alter table meal_planning.nutrition_log enable row level security;
alter table meal_planning.nutrition_log force row level security;
create policy nutrition_log_owner on meal_planning.nutrition_log
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on meal_planning.nutrition_log to lifeos_app;
