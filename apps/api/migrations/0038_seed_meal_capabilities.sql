-- 0038_seed_meal_capabilities — capability/plan seed for the Meal Planning skill
-- (same pattern as 0030_seed_wellness_capabilities). Both capabilities are granted in
-- free AND pro — planning and logging your own meals is the core of the skill.

insert into catalog.capabilities (key, domain, description) values
  ('meal.read',  'meal', 'View meal plans, grocery lists, and nutrition summaries'),
  ('meal.track', 'meal', 'Plan meals and log food/nutrition')
on conflict (key) do nothing;

insert into billing.plan_capabilities (plan_key, capability_key) values
  ('free', 'meal.read'),
  ('free', 'meal.track'),
  ('pro',  'meal.read'),
  ('pro',  'meal.track')
on conflict (plan_key, capability_key) do nothing;
