import { Injectable } from '@nestjs/common';

export interface HealthStatus {
  status: 'ok';
  uptimeSec: number;
}

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return { status: 'ok', uptimeSec: Math.floor(process.uptime()) };
  }
}
