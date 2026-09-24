import type { Page, Route } from '@playwright/test';

// Builds Anthropic Messages API streaming responses (text/event-stream) and
// intercepts the SDK's POST /v1/messages so the *real* @anthropic-ai/sdk
// streaming parser runs against canned data. Nothing below this line is
// mocked: chat.ts, the tool loop, persistence and rendering all execute.

export type CannedBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens';

function event(name: string, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Serialises `blocks` as the SSE event sequence the SDK expects. Text blocks
 * are split into several `text_delta` events so the incremental-append path
 * in chat.ts (`content + delta.text`) is exercised, not just the final message.
 */
export function sseResponse(blocks: CannedBlock[], stopReason: StopReason = 'end_turn'): string {
  let out = event('message_start', {
    type: 'message_start',
    message: {
      id: `msg_${Math.random().toString(36).slice(2, 10)}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-e2e',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    },
  });

  blocks.forEach((block, index) => {
    if (block.type === 'text') {
      out += event('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      for (const piece of chunk(block.text, 12)) {
        out += event('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: piece } });
      }
    } else {
      out += event('content_block_start', {
        type: 'content_block_start',
        index,
        content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} },
      });
      out += event('content_block_delta', {
        type: 'content_block_delta',
        index,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) },
      });
    }
    out += event('content_block_stop', { type: 'content_block_stop', index });
  });

  out += event('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 20 },
  });
  out += event('message_stop', { type: 'message_stop' });
  return out;
}

function chunk(s: string, size: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
  return parts.length ? parts : [''];
}

export type RecordedRequest = {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  tools?: unknown[];
  stream?: boolean;
  [k: string]: unknown;
};

export type AnthropicRoute = {
  /** Request bodies in the order the app sent them. */
  requests: RecordedRequest[];
  /** Resolves once the app has sent `n` requests. */
  waitForRequests: (n: number) => Promise<void>;
};

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

/**
 * Fulfils successive POST /v1/messages calls with `responses` in order.
 * A request beyond the scripted list gets a 500 so an unexpected extra
 * round-trip fails loudly instead of hanging.
 */
export async function routeAnthropic(page: Page, responses: string[]): Promise<AnthropicRoute> {
  const requests: RecordedRequest[] = [];
  const waiters: Array<{ n: number; resolve: () => void }> = [];

  await page.route('**/v1/messages', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const body = req.postDataJSON() as RecordedRequest;
    requests.push(body);
    for (const w of waiters.splice(0)) {
      if (requests.length >= w.n) w.resolve();
      else waiters.push(w);
    }

    const i = requests.length - 1;
    if (i >= responses.length) {
      await route.fulfill({
        status: 500,
        headers: { ...CORS, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'error', error: { type: 'e2e', message: `unexpected request #${i + 1}` } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: responses[i],
    });
  });

  return {
    requests,
    waitForRequests: (n) =>
      requests.length >= n
        ? Promise.resolve()
        : new Promise<void>((resolve) => waiters.push({ n, resolve })),
  };
}

/** The text content of a request message, whether it was a string or a block list. */
export function messageText(m: { content: unknown }): string {
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content
      .filter((b): b is { type: 'text'; text: string } => (b as { type?: string }).type === 'text')
      .map((b) => b.text)
      .join('');
  }
  return '';
}
