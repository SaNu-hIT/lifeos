import { describe, expect, it } from 'vitest';
import { createAIProvider, LocalAIProvider } from './index.js';

function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((s, x, i) => s + x * b[i]!, 0);
  return dot; // vectors are already L2-normalized
}

describe('ai-core LocalAIProvider', () => {
  const ai = new LocalAIProvider();

  it('embeds deterministically', async () => {
    const [a] = await ai.embed(['coffee and milk']);
    const [b] = await ai.embed(['coffee and milk']);
    expect(a).toEqual(b);
    expect(a).toHaveLength(64);
  });

  it('gives higher similarity to related text', async () => {
    const [q] = await ai.embed(['buy coffee and milk']);
    const [near] = await ai.embed(['coffee milk order']);
    const [far] = await ai.embed(['schedule a workout tomorrow']);
    expect(cosine(q!, near!)).toBeGreaterThan(cosine(q!, far!));
  });

  it('completes deterministically and streams to the same text', async () => {
    const req = { messages: [{ role: 'user' as const, content: 'hello' }] };
    const { text } = await ai.complete(req);
    expect(text).toBe('[local] hello');
    let streamed = '';
    for await (const delta of ai.stream(req)) streamed += delta.text;
    expect(streamed.trim()).toBe(text);
  });
});

describe('createAIProvider', () => {
  it('returns the local provider by default', () => {
    expect(createAIProvider().name).toBe('local');
  });
  it('throws for a deferred/unknown provider', () => {
    expect(() => createAIProvider({ provider: 'openai' })).toThrow(/not configured/);
    expect(() => createAIProvider({ provider: 'nope' })).toThrow(/unknown AI provider/);
  });
});
