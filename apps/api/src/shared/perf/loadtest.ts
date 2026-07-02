// A tiny, dependency-free load harness (docs/34). Fires a fixed number of requests at
// an endpoint with bounded concurrency and prints a latency summary — using the same
// percentile math the tests cover. Run against a live API:
//
//   node dist/shared/perf/loadtest.js http://localhost:3000/v1/health 500 20
//
// Args: <url> [totalRequests=200] [concurrency=10]. Measurement, not a benchmark of record.

import { summarizeLatencies } from './latency.js';

export interface LoadResult {
  total: number;
  ok: number;
  failed: number;
  latency: ReturnType<typeof summarizeLatencies>;
}

export async function runLoadTest(
  url: string,
  total: number,
  concurrency: number,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadResult> {
  const latencies: number[] = [];
  let ok = 0;
  let failed = 0;
  let dispatched = 0;

  async function worker(): Promise<void> {
    while (dispatched < total) {
      dispatched += 1;
      const started = Date.now();
      try {
        const res = await fetchImpl(url);
        latencies.push(Date.now() - started);
        if (res.ok) ok += 1;
        else failed += 1;
      } catch {
        latencies.push(Date.now() - started);
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  return { total, ok, failed, latency: summarizeLatencies(latencies) };
}

async function main(): Promise<void> {
  const [url, totalArg, concArg] = process.argv.slice(2);
  if (!url) {
    console.error('usage: node dist/shared/perf/loadtest.js <url> [total=200] [concurrency=10]');
    process.exit(1);
    return;
  }
  const result = await runLoadTest(url, Number(totalArg ?? 200), Number(concArg ?? 10));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1]?.endsWith('loadtest.js')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
