import { describe, it, expect, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { sdkTransport } from './sdk';
import type { TurnEvent, TurnRequest } from '../transport';

function makeStream(deltaTexts: string[], finalMessage: Record<string, unknown>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of deltaTexts) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
      // Non-text events must be ignored by the transport.
      yield { type: 'content_block_stop', index: 0 };
    },
    finalMessage: async () => finalMessage,
  };
}

function fakeClient(streamImpl: (params: unknown) => ReturnType<typeof makeStream>) {
  const stream = vi.fn(streamImpl);
  return { client: { messages: { stream } } as unknown as Anthropic, stream };
}

async function collect(it: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const out: TurnEvent[] = [];
  for await (const ev of it) out.push(ev);
  return out;
}

const baseRequest: TurnRequest = {
  model: 'claude-sonnet-4-6',
  system: 'SYSTEM PROMPT',
  tools: undefined,
  messages: [
    { id: 'u1', role: 'user', content: 'hello' },
    { id: 'a1', role: 'assistant', content: 'hi there' },
    { id: 'u2', role: 'user', content: 'again' },
  ],
};

describe('sdkTransport', () => {
  it('yields one text_delta per text_delta stream event, then a single done event', async () => {
    const final = { id: 'msg_1', model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'ab' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2 } };
    const { client } = fakeClient(() => makeStream(['a', 'b'], final));

    const events = await collect(sdkTransport(client).run(baseRequest));

    expect(events).toEqual([
      { type: 'text_delta', text: 'a' },
      { type: 'text_delta', text: 'b' },
      { type: 'done', message: expect.objectContaining({ stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 2 } }) },
    ]);
  });

  it('passes model, max_tokens, cache-controlled system prompt and tools exactly as chat.ts did', async () => {
    const { client, stream } = fakeClient(() => makeStream([], { content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } }));
    const tools = [{ name: 't', description: 'd', input_schema: { type: 'object' } }];

    await collect(sdkTransport(client).run({ ...baseRequest, tools }));

    const params = stream.mock.calls[0][0] as Record<string, unknown>;
    expect(params.model).toBe('claude-sonnet-4-6');
    expect(params.max_tokens).toBe(32000);
    expect(params.system).toEqual([{ type: 'text', text: 'SYSTEM PROMPT', cache_control: { type: 'ephemeral' } }]);
    expect(params.tools).toBe(tools);
  });

  it('strips app-only fields from messages and stamps cache_control on the last block of the last message only', async () => {
    const { client, stream } = fakeClient(() => makeStream([], { content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } }));

    await collect(sdkTransport(client).run({
      ...baseRequest,
      messages: [
        { id: 'u1', role: 'user', content: 'hello', kind: 'graph-click', graphClickData: { points: [] } },
        { id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'x' }, { type: 'text', text: 'y' }], debug: { a: 1 } },
      ],
    }));

    const params = stream.mock.calls[0][0] as { messages: Array<{ role: string; content: unknown }> };
    expect(params.messages).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: [{ type: 'text', text: 'x' }, { type: 'text', text: 'y', cache_control: { type: 'ephemeral' } }] },
    ]);
  });

  it('wraps a string-content last message into a text block before stamping cache_control', async () => {
    const { client, stream } = fakeClient(() => makeStream([], { content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } }));

    await collect(sdkTransport(client).run({ ...baseRequest, messages: [{ id: 'u1', role: 'user', content: 'solo' }] }));

    const params = stream.mock.calls[0][0] as { messages: Array<{ role: string; content: unknown }> };
    expect(params.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'solo', cache_control: { type: 'ephemeral' } }] },
    ]);
  });

  it('supports images and tool calling', () => {
    const { client } = fakeClient(() => makeStream([], {}));
    expect(sdkTransport(client).supportsImages).toBe(true);
    expect(sdkTransport(client).supportsTools).toBe(true);
  });
});
