import { Controller, Get } from '@nestjs/common';
import type { ApiResponse } from '@lifeos/contracts';
import { ok } from '../../shared/http/envelope.js';
import { type HealthStatus, HealthService } from './health.service.js';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  check(): ApiResponse<HealthStatus> {
    return ok(this.health.check());
  }
}
