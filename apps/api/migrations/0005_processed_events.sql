-- 0005_processed_events — idempotency ledger for at-least-once event delivery.
-- A (handler, event_id) pair is recorded once a subscriber successfully handles an
-- event, so redelivery is a no-op (ADR-0008).

create table platform.processed_events (
  handler text not null,
  event_id uuid not null,
  processed_at timestamptz not null default now(),
  primary key (handler, event_id)
);

grant select, insert on platform.processed_events to lifeos_app;
