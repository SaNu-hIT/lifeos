-- 0042_seed_assistant_capability — capability/plan seed for the Assistant skill.
-- Selects from billing.plans rather than hardcoding 'free'/'pro' so any future plan
-- automatically gets assistant.use too — this is a baseline capability, not a tier.

insert into catalog.capabilities (key, domain, description) values
  ('assistant.use', 'assistant', 'Ask what the assistant can do and see plan/upgrade info')
on conflict (key) do nothing;

insert into billing.plan_capabilities (plan_key, capability_key)
select key, 'assistant.use' from billing.plans
on conflict (plan_key, capability_key) do nothing;
