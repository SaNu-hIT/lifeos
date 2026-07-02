import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsRegistry } from './metrics.registry.js';

/**
 * Records request rate + latency per route/method/status into the MetricsRegistry
 * (docs/33). Uses the matched route pattern (not the raw URL) as the label so cardinality
 * stays bounded — `/v1/conversations/:id/messages`, not one series per conversation.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsRegistry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { route?: { path?: string } }>();
    const res = http.getResponse<Response>();
    const started = Date.now();
    const route = req.route?.path ?? req.path ?? 'unknown';
    const method = req.method;

    return next.handle().pipe(
      finalize(() => {
        const labels = { method, route, status: String(res.statusCode) };
        this.metrics.increment('http_requests_total', labels);
        this.metrics.observe('http_request_duration_ms', Date.now() - started, { method, route });
      }),
    );
  }
}
