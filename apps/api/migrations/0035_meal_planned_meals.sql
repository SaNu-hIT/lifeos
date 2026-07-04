-- 0035_meal_planned_meals — schema + meal planning for the Meal Planning skill
-- (docs/02 §10, ADR-0001: schema owned by the Skill). Multiple foods per (date, slot)
-- are allowed — a planned meal is one food, so there is no uniqueness constraint; the
-- grocery list is derived from these rows at read time, never stored separately. Food
-- names are freeform with a normalized companion key (like workout exercise names).

create schema if not exists meal_planning;
grant usage on schema meal_planning to lifeos_app;

create table meal_planning.planned_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references platform.users(id),
  meal_date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  food_name_normalized text not null,
  food_id text,
  servings numeric(6, 2) not null default 1,
  notes text,
  created_at timestamptz not null default now()
);
create index planned_meals_user_date_idx on meal_planning.planned_meals (user_id, meal_date);

alter table meal_planning.planned_meals enable row level security;
alter table meal_planning.planned_meals force row level security;
create policy planned_meals_owner on meal_planning.planned_meals
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on meal_planning.planned_meals to lifeos_app;
