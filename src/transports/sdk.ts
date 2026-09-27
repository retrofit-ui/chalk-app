import Anthropic from '@anthropic-ai/sdk';
import type { FinalMessage, Transport, TurnRequest, TurnEvent } from '../transport';

// The only module that imports the SDK, so the artifact build (which never reaches this
// file) can leave it out of the bundle entirely.
export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * Direct api.anthropic.com access with the user's own key. This is the original chat.ts
 * request, moved verbatim: cached system prompt, cache_control on the last block of the
 * last message, and the streaming delta loop.
 */
export function sdkTransport(client: Anthropic): Transport {
  return {
    supportsImages: true,
    async *run(req: TurnRequest): AsyncIterable<TurnEvent> {
      const lastIdx = req.messages.length - 1;
      const stream = client.messages.stream({
        model: req.model,
        max_tokens: 32000,
        system: [
          {
            type: 'text',
            text: req.system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: req.tools as never,
        messages: req.messages.map((m, i) => {
          if (i !== lastIdx) return { role: m.role, content: m.content };
          const blocks =
            typeof m.content === 'string'
              ? [{ type: 'text' as const, text: m.content }]
              : m.content.map((b) => ({ ...b }));
          const last = blocks[blocks.length - 1];
          if (last) {
            (last as { cache_control?: { type: 'ephemeral' } }).cache_control = { type: 'ephemeral' };
          }
          return { role: m.role, content: blocks };
        }),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text_delta', text: event.delta.text };
        }
      }

      yield { type: 'done', message: (await stream.finalMessage()) as FinalMessage };
    },
  };
}
