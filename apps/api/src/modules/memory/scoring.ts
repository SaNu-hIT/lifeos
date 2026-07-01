// Memory retrieval scoring: relevance × recency × importance (docs/02 §9).

const HALF_LIFE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/** Cosine similarity of two L2-normalized vectors (falls back to safe compute). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Exponential recency decay: 1.0 at age 0, 0.5 at one half-life. */
export function recencyDecay(createdAt: string, nowMs: number): number {
  const ageDays = Math.max(0, (nowMs - Date.parse(createdAt)) / MS_PER_DAY);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function memoryScore(
  similarity: number,
  importance: number,
  createdAt: string,
  nowMs: number,
): number {
  return similarity * recencyDecay(createdAt, nowMs) * Math.max(1, importance);
}
