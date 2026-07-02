// The ONLY place node-postgres is touched. Implements DatabasePort with
// service/user security contexts so RLS is enforced for user-context work.

import { Pool, type PoolClient } from 'pg';
import type { DatabasePort, DbContext, QueryResult, Tx } from './database.port.js';

/** Pool-tuning knobs (docs/34). Optional so existing call sites (tests) are unaffected. */
export interface PgPoolOptions {
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class PgDatabaseAdapter implements DatabasePort {
  private readonly pool: Pool;

  constructor(connectionString: string, options: PgPoolOptions = {}) {
    this.pool = new Pool({
      connectionString,
      max: options.max,
      idleTimeoutMillis: options.idleTimeoutMillis,
      connectionTimeoutMillis: options.connectionTimeoutMillis,
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    const result = await this.pool.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(
    fn: (tx: Tx) => Promise<T>,
    context: DbContext = { as: 'service' },
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      if (context.as === 'user') {
        // Become the non-privileged app role and bind auth.uid() for this txn so
        // Row-Level Security applies. SET LOCAL is scoped to the transaction.
        await client.query('set local role lifeos_app');
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
          context.userId,
        ]);
      }
      const result = await fn(wrapClient(client));
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // Duck-typed Nest lifecycle hook — closes the pool on app shutdown without
  // importing the framework into this adapter.
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}

function wrapClient(client: PoolClient): Tx {
  return {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    },
  };
}
