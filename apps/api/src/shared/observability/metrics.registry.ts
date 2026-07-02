import { Injectable } from '@nestjs/common';

export interface HistogramSnapshot {
  count: number;
  /** Sum of observed values (ms), for computing averages. */
  sumMs: number;
  maxMs: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramSnapshot>;
}

function labelKey(name: string, labels?: Record<string, string>): string {
  if (!labels) return name;
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`);
  return parts.length ? `${name}{${parts.join(',')}}` : name;
}

/**
 * A tiny, dependency-free in-memory metrics registry (docs/33 observability). Counters
 * for rates, histograms for latencies — enough to expose `/v1/metrics` and reason about
 * the request→plan→tool→event path. A real Prometheus/OTel exporter can replace the
 * snapshot serializer later without changing call sites.
 */
@Injectable()
export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly histograms = new Map<string, HistogramSnapshot>();

  increment(name: string, labels?: Record<string, string>, by = 1): void {
    const key = labelKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  observe(name: string, ms: number, labels?: Record<string, string>): void {
    const key = labelKey(name, labels);
    const h = this.histograms.get(key) ?? { count: 0, sumMs: 0, maxMs: 0 };
    h.count += 1;
    h.sumMs += ms;
    h.maxMs = Math.max(h.maxMs, ms);
    this.histograms.set(key, h);
  }

  snapshot(): MetricsSnapshot {
    return {
      counters: Object.fromEntries(this.counters),
      histograms: Object.fromEntries(this.histograms),
    };
  }
}
