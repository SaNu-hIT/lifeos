-- 0030_seed_wellness_capabilities — capability/plan seed for the Wellness skill
-- (docs/34 demo pattern, see 0017_seed_catalog). A new file, not an edit to 0017:
-- migrations are append-only. Both capabilities are granted in free AND pro —
-- tracking your own cycle is the whole point of the skill, not a premium upsell
-- (product decision, same rationale as workout.read/workout.track, 0026).

insert into catalog.capabilities (key, domain, description) values
  ('wellness.read',  'wellness', 'View cycle history, predictions, profile, and reminders'),
  ('wellness.track', 'wellness', 'Log cycle days, manage profile, and manage reminders')
on conflict (key) do nothing;

insert into billing.plan_capabilities (plan_key, capability_key) values
  ('free', 'wellness.read'),
  ('free', 'wellness.track'),
  ('pro',  'wellness.read'),
  ('pro',  'wellness.track')
on conflict (plan_key, capability_key) do nothing;
