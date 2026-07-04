-- 0037_meal_food_catalog_and_profile — platform-seeded food catalog for AI grounding /
-- autocomplete (same pattern as workout.exercise_catalog, 0025: not user data, no RLS,
-- never a gate — meal.plan_meal/log_food always accept freeform food names) plus the
-- one-row-per-user nutrition profile (calorie/macro targets, dietary restrictions).

create table meal_planning.food_catalog (
  id text primary key,
  name text not null,
  calories_per_serving numeric(8, 2),
  protein_g numeric(7, 2),
  carbs_g numeric(7, 2),
  fat_g numeric(7, 2),
  default_unit text
);
grant select on meal_planning.food_catalog to lifeos_app;

insert into meal_planning.food_catalog
  (id, name, calories_per_serving, protein_g, carbs_g, fat_g, default_unit) values
  ('egg',          'Egg',           78,  6,   1,   5,   'piece'),
  ('white_rice',   'White Rice',    205, 4,   45,  0,   'cup'),
  ('brown_rice',   'Brown Rice',    216, 5,   45,  2,   'cup'),
  ('chicken_breast','Chicken Breast',165, 31,  0,   4,   '100g'),
  ('banana',       'Banana',        105, 1,   27,  0,   'piece'),
  ('oats',         'Oats',          150, 5,   27,  3,   'cup'),
  ('milk',         'Milk',          103, 8,   12,  2,   'cup'),
  ('pasta',        'Pasta',         220, 8,   43,  1,   'cup'),
  ('paneer',       'Paneer',        265, 18,  6,   20,  '100g'),
  ('dal',          'Dal (Lentils)', 230, 18,  40,  1,   'cup'),
  ('roti',         'Roti',          120, 3,   18,  4,   'piece'),
  ('apple',        'Apple',         95,  0,   25,  0,   'piece'),
  ('greek_yogurt', 'Greek Yogurt',  100, 17,  6,   0,   'cup'),
  ('almonds',      'Almonds',       164, 6,   6,   14,  '28g'),
  ('tofu',         'Tofu',          144, 15,  3,   9,   '100g')
on conflict (id) do nothing;

create table meal_planning.user_profile (
  user_id uuid primary key references platform.users(id),
  daily_calorie_target integer check (daily_calorie_target >= 0),
  protein_target_g integer check (protein_target_g >= 0),
  carbs_target_g integer check (carbs_target_g >= 0),
  fat_target_g integer check (fat_target_g >= 0),
  dietary_restrictions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table meal_planning.user_profile enable row level security;
alter table meal_planning.user_profile force row level security;
create policy meal_user_profile_owner on meal_planning.user_profile
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on meal_planning.user_profile to lifeos_app;
