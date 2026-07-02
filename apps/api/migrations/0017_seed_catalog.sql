-- 0017_seed_catalog — reference data so Skills' capabilities are grantable (docs/34 demo).
-- Data-only (no new tables): seeds the capability taxonomy the Grocery + Calendar Skills
-- declare, plus a free/pro plan mapping. Idempotent; safe to re-run.

insert into catalog.capabilities (key, domain, description) values
  ('grocery.read',   'grocery',  'Search products and build a cart'),
  ('grocery.order',  'grocery',  'Place grocery orders'),
  ('calendar.read',  'calendar', 'View events and find free slots'),
  ('calendar.write', 'calendar', 'Schedule calendar events'),
  ('sample.use',     'sample',   'Use the sample skill')
on conflict (key) do nothing;

insert into billing.plans (key, name) values
  ('free', 'Free'),
  ('pro',  'Pro')
on conflict (key) do nothing;

-- Free = read-only surfaces; Pro = full read/write across the shipped Skills.
insert into billing.plan_capabilities (plan_key, capability_key) values
  ('free', 'grocery.read'),
  ('free', 'calendar.read'),
  ('free', 'sample.use'),
  ('pro',  'grocery.read'),
  ('pro',  'grocery.order'),
  ('pro',  'calendar.read'),
  ('pro',  'calendar.write'),
  ('pro',  'sample.use')
on conflict (plan_key, capability_key) do nothing;
