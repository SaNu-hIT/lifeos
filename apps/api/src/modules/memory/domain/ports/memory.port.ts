import type { MemoryBundle } from '@lifeos/contracts';

/** DI token for the MemoryPort. */
export const MEMORY = Symbol('MEMORY');

export interface NewFact {
  scope: string;
  statement: string;
  importance?: number;
  source?: string;
  expiresAt?: string | null;
}

export interface NewPreference {
  scope: string;
  key: string;
  value: unknown;
}

export interface NewSummary {
  conversationId?: string;
  summary: string;
}

export interface MemoryQuery {
  query: string;
  scope?: string;
  limit?: number;
}

/**
 * The Memory Engine (docs/02 §9, ADR-0009). Writes facts/preferences/summaries and
 * retrieves the most relevant ones ranked by similarity × recency × importance.
 */
export interface MemoryPort {
  writeFact(userId: string, fact: NewFact): Promise<void>;
  writePreference(userId: string, pref: NewPreference): Promise<void>;
  writeSummary(userId: string, summary: NewSummary): Promise<void>;
  retrieve(userId: string, query: MemoryQuery): Promise<MemoryBundle>;
  /** Remove expired/decayed low-value memories. Returns rows purged. */
  purgeExpired(): Promise<number>;
}
