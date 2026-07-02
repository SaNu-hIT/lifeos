import { Controller, Get, HttpException, Inject } from '@nestjs/common';
import type { ApiResponse } from '@lifeos/contracts';
import { ok } from '../http/envelope.js';
import { DATABASE, type DatabasePort } from '../database/database.port.js';
import { CACHE, type CachePort } from '../cache/cache.port.js';

interface ReadinessStatus {
  ready: boolean;
  checks: { database: 'up' | 'down'; redis: 'up' | 'down' };
}

/**
 * Deep readiness probe (docs/33): distinct from liveness (`/v1/health`), it verifies
 * the critical dependencies actually respond. Returns 503 if any is down so an
 * orchestrator withholds traffic until the instance can serve.
 */
@Controller({ path: 'health', version: '1' })
export class ReadinessController {
  constructor(
    @Inject(DATABASE) private readonly db: DatabasePort,
    @Inject(CACHE) private readonly cache: CachePort,
  ) {}

  @Get('ready')
  async ready(): Promise<ApiResponse<ReadinessStatus>> {
    const [database, redis] = await Promise.all([
      this.db.query('select 1').then(() => 'up' as const).catch(() => 'down' as const),
      this.cache.get('__ready_probe__').then(() => 'up' as const).catch(() => 'down' as const),
    ]);
    const ready = database === 'up' && redis === 'up';
    if (!ready) throw new HttpException({ ready, checks: { database, redis } }, 503);
    return ok({ ready, checks: { database, redis } });
  }
}
