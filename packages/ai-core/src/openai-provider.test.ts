import { describe, expect, it, vi } from 'vitest';
import { AIProviderError, OpenAIProvider } from './openai-provider.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OpenAIProvider', () => {
  it('requires an apiKey', () => {
    expect(() => new OpenAIProvider({ apiKey: '' })).toThrow(AIProviderError);
  });

  it('completes via the chat completions endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { choices: [{ message: { content: 'hello there' } }] }),
    );
    const ai = new OpenAIProvider({ apiKey: 'sk-test', model: 'gpt-test', fetchImpl });

    const { text, model } = await ai.complete({ messages: [{ role: 'user', content: 'hi' }] });

    expect(text).toBe('hello there');
    expect(model).toBe('gpt-test');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body).model).toBe('gpt-test');
  });

  it('embeds via the embeddings endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] }),
    );
    const ai = new OpenAIProvider({ apiKey: 'sk-test', fetchImpl });

    const vectors = await ai.embed(['a', 'b']);

    expect(vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('returns [] without calling out for an empty embed batch', async () => {
    const fetchImpl = vi.fn();
    const ai = new OpenAIProvider({ apiKey: 'sk-test', fetchImpl });

    expect(await ai.embed([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('streams incremental deltas from an SSE response', async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n' +
      'data: [DONE]\n\n';
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(stream, { status: 200 }));
    const ai = new OpenAIProvider({ apiKey: 'sk-test', fetchImpl });

    let text = '';
    for await (const delta of ai.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
      text += delta.text;
    }

    expect(text).toBe('hello');
  });

  it('retries once on a 429 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [{ message: { content: 'ok' } }] }));
    const ai = new OpenAIProvider({ apiKey: 'sk-test', fetchImpl });

    const { text } = await ai.complete({ messages: [{ role: 'user', content: 'hi' }] });

    expect(text).toBe('ok');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws AIProviderError on a non-retryable 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'bad key' }));
    const ai = new OpenAIProvider({ apiKey: 'sk-bad', fetchImpl });

    await expect(ai.complete({ messages: [{ role: 'user', content: 'hi' }] })).rejects.toThrow(
      AIProviderError,
    );
  });
});
