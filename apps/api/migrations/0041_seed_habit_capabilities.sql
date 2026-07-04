-- 0041_seed_habit_capabilities — capability/plan seed for the Habit skill (same
-- pattern as 0030_seed_wellness_capabilities). Both capabilities are granted in free
-- AND pro — building your own habits is the core of the skill, not a premium upsell.

insert into catalog.capabilities (key, domain, description) values
  ('habit.read',  'habit', 'View habits, streaks, and progress summaries'),
  ('habit.track', 'habit', 'Create habits and log daily check-ins')
on conflict (key) do nothing;

insert into billing.plan_capabilities (plan_key, capability_key) values
  ('free', 'habit.read'),
  ('free', 'habit.track'),
  ('pro',  'habit.read'),
  ('pro',  'habit.track')
on conflict (plan_key, capability_key) do nothing;
