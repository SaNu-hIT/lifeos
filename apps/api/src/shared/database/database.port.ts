// The database boundary. The domain never imports pg/Supabase — only adapters do
// (docs/adr/adr-0003-hexagonal-ddd.md, docs/adr/adr-0010-supabase-baas.md).

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Tx {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/**
 * The security context a unit of work runs under:
 * - `service`: trusted system operation (e.g. user provisioning, outbox relay).
 *   Bypasses RLS — used only by platform code, never on behalf of a tool.
 * - `user`: runs as the application role with `auth.uid()` bound to `userId`, so
 *   Row-Level Security is enforced (docs/11_SECURITY_GUIDE.md §2).
 */
export type DbContext = { as: 'service' } | { as: 'user'; userId: string };

export interface DatabasePort {
  /** One-off query in service context. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Run a function inside a transaction under the given security context. */
  transaction<T>(fn: (tx: Tx) => Promise<T>, context?: DbContext): Promise<T>;
  /** Close the underlying pool. */
  close(): Promise<void>;
}

/** DI token for the DatabasePort. */
export const DATABASE = Symbol('DATABASE');
