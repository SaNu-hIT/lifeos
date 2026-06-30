-- 0001_init — schemas, auth emulation, application role, shared helpers.
-- See docs/09_DATABASE_DESIGN.md §1 and docs/adr/adr-0010-supabase-baas.md.

-- Bounded-context schemas (one per domain).
create schema if not exists platform;
create schema if not exists conversation;
create schema if not exists memory;
create schema if not exists catalog;
create schema if not exists billing;
create schema if not exists surface;

-- Local emulation of Supabase's auth.uid(). In Supabase this function already
-- exists and returns the JWT `sub`; locally it reads a per-transaction GUC that the
-- database adapter sets. RLS policies are written as `... = auth.uid()` so they are
-- IDENTICAL in local Postgres and Supabase and transfer with no change.
create schema if not exists auth;
create or replace function auth.uid() returns uuid
  language sql
  stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- Non-privileged application role. The adapter SET ROLEs to this for user-context
-- queries so RLS is actually enforced (superusers and table owners bypass RLS).
-- This mirrors Supabase's `authenticated` role.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lifeos_app') then
    create role lifeos_app nologin;
  end if;
end $$;

grant usage on schema platform, conversation, memory, catalog, billing, surface, auth to lifeos_app;
grant execute on function auth.uid() to lifeos_app;

-- Shared trigger to maintain updated_at.
create or replace function platform.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
