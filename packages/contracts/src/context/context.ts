// The Unified Context handed to every tool — the single, permission-filtered data
// boundary for Skills (docs/adr/adr-0007-context-engine.md).

import type { CapabilityKey } from '../permission/capability.js';

export interface Turn {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  createdAt: string;
}

export interface Fact {
  id: string;
  scope: string;
  statement: string;
  importance: number;
}

export interface Preference {
  key: string;
  value: unknown;
  scope: string;
}

export interface Summary {
  id: string;
  summary: string;
}

export interface MemoryBundle {
  facts: Fact[];
  preferences: Preference[];
  summaries: Summary[];
}

/** The owning Skill key a context was assembled for (used for permission filtering). */
export type ContextScope = string;

export interface UnifiedContext {
  user: { id: string; locale: string; timezone: string };
  capabilities: CapabilityKey[];
  conversation: { id: string; recentTurns: Turn[] };
  memory: MemoryBundle;
  settings: Record<string, unknown>;
  scope: ContextScope;
  /** ISO-8601 timestamp; no hidden clocks (docs/02 §8). */
  now: string;
}

export interface ContextRequest {
  userId: string;
  conversationId: string;
  scope: ContextScope;
}

/** A Skill-owned contributor of domain data into context assembly. */
export interface ContextProvider {
  scope: ContextScope;
  contribute(request: ContextRequest): Promise<Partial<UnifiedContext>>;
}
