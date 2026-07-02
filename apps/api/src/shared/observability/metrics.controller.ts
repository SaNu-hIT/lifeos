import { Controller, Get } from '@nestjs/common';
import type { ApiResponse } from '@lifeos/contracts';
import { ok } from '../http/envelope.js';
import { type MetricsSnapshot, MetricsRegistry } from './metrics.registry.js';

/** Exposes the in-memory metrics snapshot for scraping/ops (docs/33). Unauthenticated
 *  by design (an internal endpoint; a real deployment scopes it at the ingress). */
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  constructor(private readonly metrics: MetricsRegistry) {}

  @Get()
  snapshot(): ApiResponse<MetricsSnapshot> {
    return ok(this.metrics.snapshot());
  }
}
