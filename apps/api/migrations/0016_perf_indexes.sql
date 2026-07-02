-- 0016_perf_indexes — hot-path indexes surfaced by the phase-34 query review.
-- All IF NOT EXISTS so the migration is safe if an index was added earlier. These back
-- the highest-frequency reads: conversation history, memory retrieval, and audit lookups.

-- Conversation history & recent-turns (keyset by conversation, newest first).
create index if not exists messages_conversation_idx
  on conversation.messages (conversation_id, created_at desc, id desc);

-- Memory retrieval loads a user's embeddings before in-app cosine ranking.
-- (memory.facts already has facts_user_scope_idx from migration 0010.)
create index if not exists memory_embeddings_user_idx
  on memory.embeddings (user_id, owner_kind);

-- Audit queries are almost always "by actor, most recent first".
create index if not exists audit_logs_actor_idx
  on platform.audit_logs (user_id, created_at desc);

-- Capability grant lookups on the permission hot path (per user, non-expired).
create index if not exists capability_grants_owner_idx
  on billing.capability_grants (user_id);
