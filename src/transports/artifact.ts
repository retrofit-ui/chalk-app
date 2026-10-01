import type { Transport, TurnRequest, TurnEvent } from '../transport';
import { extractPlan } from '../agents/ada/chunkParser';

const MISSING_RUNTIME = 'This build only runs on its claude.ai artifact page (window.claude.use is missing).';
const NOT_SERVED = 'Claude is not available in this view.';

// Viewer-facing copy per rejection code (see sample.d.ts SampleErrorCode). Unknown codes are
// treated as transient, which is what the contract asks for.
const ERROR_COPY: Record<string, string> = {
  not_granted: 'You have not allowed this artifact to use Claude. Reload the page to be asked again.',
  sampling_disabled: 'Claude is not available for your account or organization.',
  not_declared: 'This artifact was published without the Claude capability.',
  capability_disabled: NOT_SERVED,
  capability_removed: NOT_SERVED,
  session_expired: 'Your Claude session expired. Sign in again and retry.',
  rate_limited: 'Too many requests, or your usage limit is reached. Wait a bit and try again.',
  prompt_too_large: 'This conversation is too long for one request. Start a new one.',
  refused: 'Claude declined to answer this. Try rephrasing.',
  empty_completion: 'Claude produced no text. Try asking differently.',
  invalid_request: 'The request was malformed (a bug in Chalk).',
};

function describeError(e: unknown): string {
  const err = e as Partial<ArtifactSampleError> | undefined;
  const code = typeof err?.code === 'string' ? err.code : 'upstream_error';
  return ERROR_COPY[code] ?? `Claude did not answer (${code}: ${err?.message ?? String(e)}). Try again.`;
}

function renderContent(content: TurnRequest['messages'][number]['content']): string {
  if (typeof content === 'string') return content;
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text);
    else if (block.type === 'image') parts.push('[drawing omitted]');
    // tool_use / tool_result only appear in conversations created by the SDK build;
    // the model has no tools here, so replaying them would only confuse it.
  }
  return parts.join('\n');
}

/**
 * The sample runtime takes a turns array with no system role, so the agent's (inline) system
 * prompt becomes a leading user turn and the history follows. Chat.ts always calls after
 * pushing the user message, so the array ends on a user turn as the contract requires.
 */
export function buildSampleTurns(req: TurnRequest): ArtifactSampleMessage[] {
  const turns: ArtifactSampleMessage[] = [{ role: 'user', content: req.system }];
  for (const m of req.messages) {
    const body = renderContent(m.content);
    if (!body.trim()) continue;
    turns.push({ role: m.role, content: body });
  }
  return turns;
}

const FENCE_OPEN = '```chalk-plan';

/**
 * Streams text through while withholding a ```chalk-plan fence, so the plan never flashes
 * as a code block in the bubble before extractPlan removes it at the end. Text that might be
 * the start of the fence marker is held until the next delta decides.
 */
export function planFenceFilter(): { push(delta: string): string; flush(): string } {
  let buf = '';
  let inFence = false;
  return {
    push(delta) {
      buf += delta;
      let out = '';
      for (;;) {
        if (inFence) {
          const { content } = extractPlan(buf);
          if (content === buf) return out; // closing fence not here yet
          buf = content;
          inFence = false;
          continue;
        }
        const at = buf.indexOf(FENCE_OPEN);
        if (at >= 0) {
          out += buf.slice(0, at);
          buf = buf.slice(at);
          inFence = true;
          continue;
        }
        // Emit everything except a tail that could still grow into the marker.
        let hold = 0;
        for (let k = Math.min(buf.length, FENCE_OPEN.length - 1); k > 0; k--) {
          if (FENCE_OPEN.startsWith(buf.slice(-k))) { hold = k; break; }
        }
        out += buf.slice(0, buf.length - hold);
        buf = buf.slice(buf.length - hold);
        return out;
      }
    },
    flush() {
      const rest = buf;
      buf = '';
      inFence = false;
      return rest;
    },
  };
}

/** Reaches the model through the artifact runtime's `sample` capability: the viewer's own claude.ai account. */
export function artifactTransport(): Transport {
  return {
    supportsImages: false,
    supportsTools: false,
    async *run(req: TurnRequest): AsyncIterable<TurnEvent> {
      const use = typeof window !== 'undefined' ? window.claude?.use : undefined;
      if (typeof use !== 'function') throw new Error(MISSING_RUNTIME);
      const sample = await use.call(window.claude, 'sample');
      if (!sample) throw new Error(NOT_SERVED);

      // Bridge the onText callback into this generator: deltas queue up, and the loop sleeps
      // until the next delta or the promise settling wakes it.
      const queue: string[] = [];
      let settled: { result: ArtifactSampleResult } | { error: unknown } | undefined;
      let wake: (() => void) | undefined;
      const notify = () => { wake?.(); wake = undefined; };

      sample(buildSampleTurns(req), {
        cache: false,
        onText: ({ delta }) => { queue.push(delta); notify(); },
      }).then(
        (result) => { settled = { result }; notify(); },
        (error: unknown) => { settled = { error }; notify(); },
      );

      const filter = planFenceFilter();
      let streamed = '';
      for (;;) {
        while (queue.length) {
          const delta = queue.shift()!;
          streamed += delta;
          const text = filter.push(delta);
          if (text) yield { type: 'text_delta', text };
        }
        if (settled) break;
        await new Promise<void>((resolve) => { wake = resolve; });
      }

      if ('error' in settled) {
        const err = settled.error as Partial<ArtifactSampleError> | undefined;
        if (err?.code !== 'cancelled') throw new Error(describeError(settled.error));
        const text = err.text ?? streamed;
        yield { type: 'done', message: { content: [{ type: 'text', text }], stop_reason: 'cancelled' }, plan: undefined };
        return;
      }

      const rest = filter.flush();
      if (rest) yield { type: 'text_delta', text: rest };
      const { content, plan } = extractPlan(settled.result.text);
      yield {
        type: 'done',
        message: {
          content: [{ type: 'text', text: content }],
          stop_reason: settled.result.truncated ? 'max_tokens' : 'end_turn',
        },
        plan,
      };
    },
  };
}
