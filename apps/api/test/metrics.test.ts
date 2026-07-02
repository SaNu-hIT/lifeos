import { describe, expect, it } from 'vitest';
import { MetricsRegistry } from '../src/shared/observability/metrics.registry.js';

describe('Phase 33 — MetricsRegistry (unit)', () => {
  it('accumulates counters, with labels producing distinct series', () => {
    const m = new MetricsRegistry();
    m.increment('http_requests_total', { route: '/a', status: '200' });
    m.increment('http_requests_total', { route: '/a', status: '200' });
    m.increment('http_requests_total', { route: '/a', status: '500' });
    const snap = m.snapshot();
    expect(snap.counters['http_requests_total{route=/a,status=200}']).toBe(2);
    expect(snap.counters['http_requests_total{route=/a,status=500}']).toBe(1);
  });

  it('label order does not create duplicate series', () => {
    const m = new MetricsRegistry();
    m.increment('x', { a: '1', b: '2' });
    m.increment('x', { b: '2', a: '1' });
    expect(m.snapshot().counters['x{a=1,b=2}']).toBe(2);
  });

  it('observes histogram count/sum/max', () => {
    const m = new MetricsRegistry();
    m.observe('lat', 10);
    m.observe('lat', 30);
    const h = m.snapshot().histograms['lat'];
    expect(h).toEqual({ count: 2, sumMs: 40, maxMs: 30 });
  });
});
