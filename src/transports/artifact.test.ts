import { describe, it, expect, vi, afterEach } from 'vitest';
import { artifactTransport, buildSampleTurns, planFenceFilter } from './artifact';
import type { TurnEvent, TurnRequest } from '../transport';

async function collect(it: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const out: TurnEvent[] = [];
  for await (const ev of it) out.push(ev);
  return out;
}

const req: TurnRequest = {
  model: 'ignored-by-artifact-runtime',
  system: 'You are Ada.',
  messages: [
    { id: 'u1', role: 'user', content: 'What is a derivative?' },
    { id: 'a1', role: 'assistant', content: 'A rate of change. Want a graph?' },
    { id: 'u2', role: 'user', content: 'Yes please' },
  ],
};

describe('buildSampleTurns', () => {
  it('puts the system prompt in a leading user turn (sample has no system role) and the history after it', () => {
    expect(buildSampleTurns(req)).toEqual([
      { role: 'user', content: 'You are Ada.' },
      { role: 'user', content: 'What is a derivative?' },
      { role: 'assistant', content: 'A rate of change. Want a graph?' },
      { role: 'user', content: 'Yes please' },
    ]);
  });

  it('starts and ends on a user turn, as the runtime requires', () => {
    const turns = buildSampleTurns(req);
    expect(turns[0].role).toBe('user');
    expect(turns[turns.length - 1].role).toBe('user');
  });

  it('flattens array content: text blocks verbatim, image blocks as a placeholder', () => {
    const turns = buildSampleTurns({
      ...req,
      messages: [
        {
          id: 'u1',
          role: 'user',
          content: [
            { type: 'text', text: 'Here is my drawing:' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
          ],
        },
      ],
    });
    expect(turns[1]).toEqual({ role: 'user', content: 'Here is my drawing:\n[drawing omitted]' });
  });

  it('skips tool_use and tool_result blocks left over from SDK-era conversations, dropping emptied turns', () => {
    const turns = buildSampleTurns({
      ...req,
      messages: [
        { id: 'u1', role: 'user', content: 'hi' },
        { id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'Let me plan.' }, { type: 'tool_use', id: 't1', name: 'set_lesson_plan', input: { plan: 'SECRET' } }] },
        { id: 'u2', role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'Plan saved.' }], kind: 'tool-result' },
        { id: 'u3', role: 'user', content: 'ok' },
      ],
    });
    expect(turns.slice(1)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'Let me plan.' },
      { role: 'user', content: 'ok' },
    ]);
    expect(JSON.stringify(turns)).not.toContain('SECRET');
  });
});

describe('planFenceFilter', () => {
  it('passes ordinary text straight through, including inline code and other fences', () => {
    const f = planFenceFilter();
    expect(f.push('use `x` here\n```js\ncode\n```\n')).toBe('use `x` here\n```js\ncode\n```\n');
    expect(f.flush()).toBe('');
  });

  it('holds back trailing backticks that might open a chalk-plan fence until it knows', () => {
    const f = planFenceFilter();
    expect(f.push('see ``')).toBe('see ');
    expect(f.push('`js\n')).toBe('```js\n');
  });

  it('withholds a chalk-plan fence that spans deltas and emits only the text around it', () => {
    const f = planFenceFilter();
    expect(f.push('Intro.\n``')).toBe('Intro.\n');
    expect(f.push('`chalk-plan\n# Plan\n1. x')).toBe('');
    expect(f.push('\n```\n\nBody')).toBe('Body');
    expect(f.flush()).toBe('');
  });

  it('flushes an unterminated fence at the end so nothing is silently lost', () => {
    const f = planFenceFilter();
    expect(f.push('x ```chalk-plan\n# P')).toBe('x ');
    expect(f.flush()).toBe('```chalk-plan\n# P');
  });
});

type SampleStub = ReturnType<typeof vi.fn>;

describe('artifactTransport', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  /** Installs window.claude.use resolving `sample` (or null) the way the artifact runtime does. */
  function installRuntime(sample: SampleStub | null) {
    const use = vi.fn(async (name: string) => (name === 'sample' ? sample : null));
    (globalThis as { window?: unknown }).window = { claude: { use } };
    return use;
  }

  /** A sample() that streams the given deltas through onText, then resolves. */
  function streaming(deltas: string[], result: Partial<{ truncated: boolean }> = {}): SampleStub {
    return vi.fn(async (_input: unknown, opts: { onText?: (u: { text: string; delta: string }) => void }) => {
      let text = '';
      for (const delta of deltas) {
        await Promise.resolve();
        text += delta;
        opts.onText?.({ text, delta });
      }
      return { text, truncated: false, modelTierApplied: 'default', ...result };
    });
  }

  it('cannot send images or call tools', () => {
    expect(artifactTransport().supportsImages).toBe(false);
    expect(artifactTransport().supportsTools).toBe(false);
  });

  it('throws a clear error when window.claude.use is missing (file opened outside claude.ai)', async () => {
    (globalThis as { window?: unknown }).window = {};
    await expect(collect(artifactTransport().run(req))).rejects.toThrow(
      'This build only runs on its claude.ai artifact page (window.claude.use is missing).',
    );
  });

  it('throws a clear error when the sample capability resolves null', async () => {
    installRuntime(null);
    await expect(collect(artifactTransport().run(req))).rejects.toThrow('Claude is not available in this view.');
  });

  it('calls sample with the built turns, caching off, and an onText handler', async () => {
    const sample = streaming(['Hi']);
    installRuntime(sample);
    await collect(artifactTransport().run(req));
    expect(sample).toHaveBeenCalledTimes(1);
    const [input, opts] = sample.mock.calls[0] as [unknown, { cache: boolean; onText: unknown }];
    expect(input).toEqual(buildSampleTurns(req));
    expect(opts.cache).toBe(false);
    expect(typeof opts.onText).toBe('function');
  });

  it('yields one text_delta per streamed delta, in order, then done with end_turn', async () => {
    installRuntime(streaming(['Sure! ', 'Here is ', 'a graph.']));
    const events = await collect(artifactTransport().run(req));
    expect(events).toEqual([
      { type: 'text_delta', text: 'Sure! ' },
      { type: 'text_delta', text: 'Here is ' },
      { type: 'text_delta', text: 'a graph.' },
      {
        type: 'done',
        message: { content: [{ type: 'text', text: 'Sure! Here is a graph.' }], stop_reason: 'end_turn' },
        plan: undefined,
      },
    ]);
  });

  it('never streams a chalk-plan fence and carries the plan on the done event', async () => {
    installRuntime(streaming(['Intro.\n``', '`chalk-plan\n# Plan\n1. x', '\n```\n\nBody.']));
    const events = await collect(artifactTransport().run(req));
    const deltas = events.filter((e) => e.type === 'text_delta').map((e) => (e as { text: string }).text);
    expect(deltas.join('')).toBe('Intro.\nBody.');
    expect(deltas.join('')).not.toContain('chalk-plan');
    const done = events[events.length - 1] as Extract<TurnEvent, { type: 'done' }>;
    expect(done.plan).toBe('# Plan\n1. x');
    expect(done.message.content).toEqual([{ type: 'text', text: 'Intro.\nBody.' }]);
  });

  it('reports a truncated answer as stop_reason max_tokens', async () => {
    installRuntime(streaming(['half an ans'], { truncated: true }));
    const events = await collect(artifactTransport().run(req));
    expect(events[events.length - 1]).toMatchObject({ type: 'done', message: { stop_reason: 'max_tokens' } });
  });

  it('turns a sample rejection into an Error with viewer-facing copy keyed by code', async () => {
    installRuntime(vi.fn(async () => { throw { code: 'not_granted', message: 'dev text' }; }));
    await expect(collect(artifactTransport().run(req))).rejects.toThrow(
      'You have not allowed this artifact to use Claude. Reload the page to be asked again.',
    );
  });

  it('treats an unknown rejection code as a transient upstream error', async () => {
    installRuntime(vi.fn(async () => { throw { code: 'something_new', message: 'dev text' }; }));
    await expect(collect(artifactTransport().run(req))).rejects.toThrow(/Claude did not answer.*dev text/);
  });

  it('ends a cancelled call as a done event with stop_reason cancelled and whatever streamed', async () => {
    const sample = vi.fn(async (_i: unknown, opts: { onText: (u: { text: string; delta: string }) => void }) => {
      await Promise.resolve();
      opts.onText({ text: 'partial', delta: 'partial' });
      throw { code: 'cancelled', message: 'aborted', text: 'partial' };
    });
    installRuntime(sample);
    const events = await collect(artifactTransport().run(req));
    expect(events).toEqual([
      { type: 'text_delta', text: 'partial' },
      { type: 'done', message: { content: [{ type: 'text', text: 'partial' }], stop_reason: 'cancelled' }, plan: undefined },
    ]);
  });
});
