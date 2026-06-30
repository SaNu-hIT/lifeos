---
title: Database Migration / Table Template
status: Authoritative
version: 1.0.0
type: template
---

# Database Migration / Table Template

> Copy this when adding or changing a table. Follows [09 Database Design](../docs/09_DATABASE_DESIGN.md): schema-per-domain, UUIDv7 keys, timestamps, RLS on user-owned tables, forward-only numbered migrations.

## Migration file

`migrations/NNNN_<description>.sql` (next number after the current **Database version** in [06](../docs/06_PROJECT_STATE.md)).

```sql
-- 00NN_add_<table>.sql
create table <schema>.<table> (
  id          uuid primary key default uuidv7(),
  user_id     uuid not null references platform.users(id),
  -- domain columns...
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at trigger
create trigger <table>_set_updated_at before update on <schema>.<table>
  for each row execute function platform.set_updated_at();

-- RLS (user-owned tables only)
alter table <schema>.<table> enable row level security;
create policy <table>_owner on <schema>.<table>
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- indexes for hot read paths / keyset pagination
create index on <schema>.<table> (user_id, created_at desc);
```

## Conventions checklist

- [ ] Correct **schema** (`platform`/`memory`/`conversation`/`catalog`/`billing`/`surface`/`<skill>`).
- [ ] `id uuid` (UUIDv7), FKs `<entity>_id`, `created_at`/`updated_at timestamptz`.
- [ ] **RLS enabled + owner policy** on any user-owned table.
- [ ] Append-only tables (`audit_logs`, `activities`, `outbox`) have **no** update/delete grants.
- [ ] Indexes for query/pagination patterns; HNSW for vector columns.
- [ ] Money as integer minor unit; enums via `check` constraints or lookup tables.
- [ ] Forward-only; reversible via a **new** migration, not a down-migration in prod.
- [ ] Backfills run as separate idempotent jobs, **not** inside the migration txn.

## Tests

- [ ] Integration test applies the migration on a fresh DB.
- [ ] RLS test: cross-user read returns nothing.

## Definition of Done

- [ ] Migration reviewed and numbered.
- [ ] [09 Database Design](../docs/09_DATABASE_DESIGN.md) table catalog updated.
- [ ] **Database version** bumped in [06 PROJECT_STATE](../docs/06_PROJECT_STATE.md) (same PR).
- [ ] If a public contract/schema shape changed → ADR + contract version bump.
