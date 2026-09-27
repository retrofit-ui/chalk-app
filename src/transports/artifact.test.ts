import { describe, it, expect, vi, afterEach } from 'vitest';
import { artifactTransport, buildArtifactPrompt } from './artifact';
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

describe('buildArtifactPrompt', () => {
  it('starts with the system prompt and serializes the history as User/Assistant sections in order', () => {
    const prompt = buildArtifactPrompt(req);
    expect(prompt.startsWith('You are Ada.')).toBe(true);
    const u1 = prompt.indexOf('### User\nWhat is a derivative?');
    const a1 = prompt.indexOf('### Assistant\nA rate of change. Want a graph?');
    const u2 = prompt.indexOf('### User\nYes please');
    expect(u1).toBeGreaterThan(0);
    expect(a1).toBeGreaterThan(u1);
    expect(u2).toBeGreaterThan(a1);
  });

  it('ends by cueing the next assistant turn', () => {
    expect(buildArtifactPrompt(req).trimEnd().endsWith('### Assistant')).toBe(true);
  });

  it('flattens array content: text blocks verbatim, image blocks as a placeholder', () => {
    const prompt = buildArtifactPrompt({
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
    expect(prompt).toContain('### User\nHere is my drawing:\n[drawing omitted]');
    expect(prompt).not.toContain('AAAA');
  });

  it('skips tool_use and tool_result blocks left over from SDK-era conversations', () => {
    const prompt = buildArtifactPrompt({
      ...req,
      messages: [
        { id: 'u1', role: 'user', content: 'hi' },
        { id: 'a1', role: 'assistant', content: [{ type: 'text', text: 'Let me plan.' }, { type: 'tool_use', id: 't1', name: 'set_lesson_plan', input: { plan: 'SECRET' } }] },
        { id: 'u2', role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'Plan saved.' }], kind: 'tool-result' },
        { id: 'u3', role: 'user', content: 'ok' },
      ],
    });
    expect(prompt).toContain('### Assistant\nLet me plan.');
    expect(prompt).not.toContain('SECRET');
    expect(prompt).not.toContain('Plan saved.');
    expect(prompt).not.toContain('set_lesson_plan');
  });
});

describe('artifactTransport', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  function installClaude(complete: (prompt: string) => Promise<string>) {
    (globalThis as { window?: unknown }).window = { claude: { complete } };
    return complete;
  }

  it('cannot send images', () => {
    expect(artifactTransport().supportsImages).toBe(false);
  });

  it('throws a clear error when window.claude.complete is missing', async () => {
    (globalThis as { window?: unknown }).window = {};
    await expect(collect(artifactTransport().run(req))).rejects.toThrow(
      'This build only runs inside a Claude artifact (window.claude.complete is missing).',
    );
  });

  it('calls window.claude.complete with the built prompt and yields the reply as one delta then done', async () => {
    const complete = installClaude(vi.fn(async () => 'Sure! Here is a graph.'));
    const events = await collect(artifactTransport().run(req));
    expect(complete).toHaveBeenCalledWith(buildArtifactPrompt(req));
    expect(events).toEqual([
      { type: 'text_delta', text: 'Sure! Here is a graph.' },
      {
        type: 'done',
        message: { content: [{ type: 'text', text: 'Sure! Here is a graph.' }], stop_reason: 'end_turn' },
        plan: undefined,
      },
    ]);
  });

  it('strips a chalk-plan fence from the reply and carries it on the done event', async () => {
    installClaude(async () => 'Intro.\n\n```chalk-plan\n# Plan\n1. x\n```\n\nBody.');
    const events = await collect(artifactTransport().run(req));
    expect(events[0]).toEqual({ type: 'text_delta', text: 'Intro.\n\nBody.' });
    expect(events[1]).toMatchObject({ type: 'done', plan: '# Plan\n1. x' });
    expect((events[1] as { message: { content: Array<{ text: string }> } }).message.content[0].text).toBe('Intro.\n\nBody.');
  });

  it('propagates a rejection from window.claude.complete', async () => {
    installClaude(async () => { throw new Error('rate limited'); });
    await expect(collect(artifactTransport().run(req))).rejects.toThrow('rate limited');
  });
});
