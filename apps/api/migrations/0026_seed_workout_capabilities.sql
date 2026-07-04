-- 0026_seed_workout_capabilities — capability/plan seed for the Workout skill (docs/34
-- demo pattern, see 0017_seed_catalog). A new file, not an edit to 0017: migrations are
-- append-only. Both capabilities are granted in free AND pro — logging your own
-- workouts is the whole point of the skill, not a premium upsell (product decision).

insert into catalog.capabilities (key, domain, description) values
  ('workout.read',  'workout', 'View workout history, PRs, and training profile'),
  ('workout.track', 'workout', 'Log workouts, sets, and manage training profile')
on conflict (key) do nothing;

insert into billing.plan_capabilities (plan_key, capability_key) values
  ('free', 'workout.read'),
  ('free', 'workout.track'),
  ('pro',  'workout.read'),
  ('pro',  'workout.track')
on conflict (plan_key, capability_key) do nothing;
