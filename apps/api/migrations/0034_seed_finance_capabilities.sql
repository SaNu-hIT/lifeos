-- 0034_seed_finance_capabilities — capability/plan seed for the Finance skill
-- (same pattern as 0030_seed_wellness_capabilities). Migrations are append-only, so
-- this is a new file. Both capabilities are granted in free AND pro — tracking your
-- own money is the whole point of the skill, not a premium upsell (same rationale as
-- workout.read/track and wellness.read/track).

insert into catalog.capabilities (key, domain, description) values
  ('finance.read',  'finance', 'View transactions, budgets, bills, and summaries'),
  ('finance.track', 'finance', 'Log transactions, manage budgets and recurring bills')
on conflict (key) do nothing;

insert into billing.plan_capabilities (plan_key, capability_key) values
  ('free', 'finance.read'),
  ('free', 'finance.track'),
  ('pro',  'finance.read'),
  ('pro',  'finance.track')
on conflict (plan_key, capability_key) do nothing;
