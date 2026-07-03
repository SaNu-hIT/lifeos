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

  // The AIPlanner prompt: a system message asking for {"steps":[...]} JSON + a user
  // message "Intent: ...\nTools: [...]". The local provider answers with a real plan
  // so the orchestrator→planner→tool path runs offline.
  function plannerReq(intent: string, tools: unknown) {
    return {
      messages: [
        { role: 'system' as const, content: 'Return ONLY JSON of the form {"steps":[...]}.' },
        { role: 'user' as const, content: `Intent: ${intent}\nTools: ${JSON.stringify(tools)}` },
      ],
    };
  }

  it('plans: matches the intent to a tool and fills string args', async () => {
    const tools = [
      {
        name: 'grocery.search_products',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      },
    ];
    const { text } = await ai.complete(plannerReq('search for milk', tools));
    expect(JSON.parse(text)).toEqual({ steps: [{ tool: 'grocery.search_products', args: { query: 'milk' } }] });
  });

  it('plans: picks a no-arg tool by verb synonym', async () => {
    const tools = [
      { name: 'grocery.place_order', inputSchema: { type: 'object', properties: {} } },
      { name: 'grocery.search_products', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    ];
    const { text } = await ai.complete(plannerReq('place my order now', tools));
    expect(JSON.parse(text)).toEqual({ steps: [{ tool: 'grocery.place_order', args: {} }] });
  });

  it('plans: empty steps when no tool matches or required args are unfillable', async () => {
    const tools = [
      // requires an array it cannot synthesize from free text → skipped
      { name: 'grocery.build_cart', inputSchema: { type: 'object', properties: { items: { type: 'array' } }, required: ['items'] } },
    ];
    const matchNothing = await ai.complete(plannerReq('what is the weather', tools));
    expect(JSON.parse(matchNothing.text)).toEqual({ steps: [] });
    const unfillable = await ai.complete(plannerReq('add items to cart', tools));
    expect(JSON.parse(unfillable.text)).toEqual({ steps: [] });
  });
});

describe('createAIProvider', () => {
  it('returns the local provider by default', () => {
    expect(createAIProvider().name).toBe('local');
  });
  it('returns the openai provider when configured with a key', () => {
    expect(createAIProvider({ provider: 'openai', apiKey: 'sk-test' }).name).toBe('openai');
  });
  it('throws for an unregistered provider', () => {
    expect(() => createAIProvider({ provider: 'nope' })).toThrow(/unknown AI provider/);
  });
});
