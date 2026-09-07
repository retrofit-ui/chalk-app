import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';
import type Anthropic from '@anthropic-ai/sdk';
import {
  sendMessage,
  buildGraphClickMessage,
  buildDrawSubmissionMessage,
  buildAnswerSubmitMessage,
  MAX_TOOL_ROUNDS,
  type SendMessageDeps,
} from './chat';
import type { Conversation } from './conversations';
import type { Agent } from './agents/types';

vi.mock('./anthropic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./anthropic')>();
  return { ...actual, makeClient: vi.fn(actual.makeClient) };
});
import { makeClient } from './anthropic';

// --- test helpers -----------------------------------------------------

function makeConvStore(overrides: Partial<Conversation> = {}) {
  let store!: Conversation;
  let setStore!: SetStoreFunction<Conversation>;
  createRoot(() => {
    [store, setStore] = createStore<Conversation>({
      id: 'conv-1',
      title: 'New conversation',
      createdAt: 0,
      updatedAt: 0,
      messages: [],
      model: 'claude-sonnet-4-6',
      agentId: 'ada',
      plans: [],
      ...overrides,
    });
  });
  return { getConv: () => store, setConv: setStore };
}

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'test-agent',
    name: 'Test',
    version: '1.0.0',
    description: '',
    systemPrompt: 'You are a helpful test agent.',
    skills: [],
    Harness: (() => null) as unknown as Agent['Harness'],
    ...overrides,
  };
}

type FakeFinalMessage = {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: Array<{ type: string; [k: string]: unknown }>;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  };
};

function makeFinalMessage(overrides: Partial<FakeFinalMessage> = {}): FakeFinalMessage {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    content: [{ type: 'text', text: 'Hello!' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    ...overrides,
  };
}

function makeStream(deltaTexts: string[], finalMessage: FakeFinalMessage) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of deltaTexts) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
    },
    finalMessage: async () => finalMessage,
  };
}

function makeErrorStream(err: Error, deltaTexts: string[] = []) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const text of deltaTexts) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text } };
      }
      throw err;
    },
    finalMessage: async () => {
      throw err;
    },
  };
}

function fakeClient(streamImpl: (params: unknown) => ReturnType<typeof makeStream>) {
  return { messages: { stream: vi.fn(streamImpl) } } as unknown as Anthropic;
}

function fakeClientSequence(streams: Array<ReturnType<typeof makeStream>>) {
  let i = 0;
  const streamFn = vi.fn(() => streams[i++]);
  return { messages: { stream: streamFn } } as unknown as Anthropic;
}

// --- sendMessage --------------------------------------------------------

describe('sendMessage', () => {
  describe('terminal single-round turn', () => {
    it('pushes the user message onto conversation.messages before making any API call', async () => {
      const { getConv, setConv } = makeConvStore();
      let messagesAtCallTime: Conversation['messages'] = [];
      const client = fakeClient(() => {
        messagesAtCallTime = getConv().messages.slice();
        return makeStream([], makeFinalMessage());
      });
      await sendMessage(
        { role: 'user', content: 'Hi Ada' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(messagesAtCallTime.some((m) => m.role === 'user' && m.content === 'Hi Ada')).toBe(true);
    });

    it('sets the conversation title from the first user message when this is the first message', async () => {
      const { getConv, setConv } = makeConvStore();
      const client = fakeClient(() => makeStream([], makeFinalMessage()));
      await sendMessage(
        { role: 'user', content: 'Explain derivatives' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().title).toBe('Explain derivatives');
    });

    it('does not overwrite an existing title on subsequent messages', async () => {
      const { getConv, setConv } = makeConvStore({
        title: 'Existing title',
        messages: [
          { id: 'u0', role: 'user', content: 'first' },
          { id: 'a0', role: 'assistant', content: 'reply' },
        ],
      });
      const client = fakeClient(() => makeStream([], makeFinalMessage()));
      await sendMessage(
        { role: 'user', content: 'second question' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().title).toBe('Existing title');
    });

    it('streams text deltas into the assistant message content incrementally as events arrive', async () => {
      const { getConv, setConv: realSetConv } = makeConvStore();
      const setConvSpy = vi.fn((...args: unknown[]) =>
        (realSetConv as (...a: unknown[]) => void)(...args),
      );
      const client = fakeClient(() =>
        makeStream(['Hel', 'lo', '!'], makeFinalMessage({ content: [{ type: 'text', text: 'Hello!' }] })),
      );
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv: setConvSpy as unknown as typeof realSetConv, onError: () => {}, client },
      );
      const contentDeltaCalls = setConvSpy.mock.calls.filter(
        (c) => c[0] === 'messages' && c[2] === 'content' && typeof c[3] === 'function',
      );
      expect(contentDeltaCalls.length).toBe(3);
      expect(getConv().messages[1].content).toBe('Hello!');
    });

    it('leaves the assistant message content as the full streamed text on a plain terminal turn', async () => {
      const { getConv, setConv } = makeConvStore();
      const client = fakeClient(() =>
        makeStream(['Hello', ' world'], makeFinalMessage({ content: [{ type: 'text', text: 'Hello world' }] })),
      );
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[1].content).toBe('Hello world');
    });

    it('records model, stopReason, and a debug object on the assistant message', async () => {
      const { getConv, setConv } = makeConvStore({ model: 'claude-opus-4-7' });
      const client = fakeClient(() => makeStream([], makeFinalMessage({ stop_reason: 'end_turn' })));
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      const assistantMsg = getConv().messages[1];
      expect(assistantMsg.model).toBe('claude-opus-4-7');
      expect(assistantMsg.stopReason).toBe('end_turn');
      expect(assistantMsg.debug).toBeDefined();
      expect(assistantMsg.debug?.stop_reason).toBe('end_turn');
    });

    it('accumulates usage (input/output/cache-creation/cache-read tokens) onto conversation.usage', async () => {
      const { getConv, setConv } = makeConvStore();
      const client = fakeClient(() =>
        makeStream(
          [],
          makeFinalMessage({
            usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 20, cache_read_input_tokens: 5 },
          }),
        ),
      );
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().usage).toMatchObject({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 20,
        cacheReadTokens: 5,
      });
    });

    it('accumulates estimated cost onto conversation.usage.costUsd across multiple calls', async () => {
      const { getConv, setConv } = makeConvStore();
      const client = fakeClient(() =>
        makeStream(
          [],
          makeFinalMessage({
            usage: { input_tokens: 1_000_000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }),
        ),
      );
      const deps: SendMessageDeps = { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client };
      await sendMessage({ role: 'user', content: 'first' }, deps);
      const costAfterFirst = getConv().usage!.costUsd;
      await sendMessage({ role: 'user', content: 'second' }, deps);
      const costAfterSecond = getConv().usage!.costUsd;
      expect(costAfterFirst).toBeCloseTo(3, 5);
      expect(costAfterSecond).toBeCloseTo(6, 5);
    });

    it('injects ephemeral cache_control onto the last content block of the last prior message', async () => {
      const { getConv, setConv } = makeConvStore();
      let capturedParams: { messages: Array<{ content: Array<{ cache_control?: unknown }> }> } | undefined;
      const client = fakeClient((params) => {
        capturedParams = params as typeof capturedParams;
        return makeStream([], makeFinalMessage());
      });
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      const lastMsg = capturedParams!.messages[capturedParams!.messages.length - 1];
      const lastBlock = lastMsg.content[lastMsg.content.length - 1];
      expect(lastBlock.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('calls persist and refreshList after a successful terminal turn', async () => {
      const { getConv, setConv } = makeConvStore();
      const persist = vi.fn();
      const refreshList = vi.fn();
      const client = fakeClient(() => makeStream([], makeFinalMessage()));
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client, persist, refreshList },
      );
      expect(persist).toHaveBeenCalled();
      expect(refreshList).toHaveBeenCalled();
    });

    it('calls setActiveId once, right after the user message is pushed', async () => {
      const { getConv, setConv } = makeConvStore();
      const setActiveId = vi.fn();
      const client = fakeClient(() => makeStream([], makeFinalMessage()));
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client, setActiveId },
      );
      expect(setActiveId).toHaveBeenCalledTimes(1);
      expect(setActiveId).toHaveBeenCalledWith(getConv().id);
    });
  });

  describe('set_lesson_plan tool calls', () => {
    it('pushes the plan onto conversation.plans for a valid set_lesson_plan call', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'set_lesson_plan', input: { plan: '# Goals\n- learn math' } }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'Great, let\'s start!' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream(["Great, let's start!"], terminalFinal)]);
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'teach me' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().plans).toEqual(['# Goals\n- learn math']);
    });

    it('returns a "Plan saved." tool_result for a valid set_lesson_plan call', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'set_lesson_plan', input: { plan: '# Goals' } }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'ok' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream(['ok'], terminalFinal)]);
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'teach me' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[2].content).toEqual([
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'Plan saved.' },
      ]);
    });

    it('does not call agent.executeSkill for a set_lesson_plan call', async () => {
      const executeSkill = vi.fn(() => 'should not be called');
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'set_lesson_plan', input: { plan: '# Goals' } }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'ok' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream(['ok'], terminalFinal)]);
      const agent = makeAgent({ executeSkill });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'teach me' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(executeSkill).not.toHaveBeenCalled();
    });

    it('returns an error tool_result and does not touch conversation.plans when plan input is missing', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'set_lesson_plan', input: {} }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'ok' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream(['ok'], terminalFinal)]);
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'teach me' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[2].content).toEqual([
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'Invalid input: "plan" must be a non-empty string.' },
      ]);
      expect(getConv().plans).toEqual([]);
    });

    it('returns an error tool_result when plan input is not a string', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'set_lesson_plan', input: { plan: 123 } }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'ok' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream(['ok'], terminalFinal)]);
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'teach me' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[2].content).toEqual([
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'Invalid input: "plan" must be a non-empty string.' },
      ]);
      expect(getConv().plans).toEqual([]);
    });

    it('continues the round loop after a set_lesson_plan call, like any other tool_use round', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'set_lesson_plan', input: { plan: '# Goals' } }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'Let\'s begin.' }] });
      const streamFn = vi
        .fn()
        .mockReturnValueOnce(makeStream([], toolUseFinal))
        .mockReturnValueOnce(makeStream(["Let's begin."], terminalFinal));
      const client = { messages: { stream: streamFn } } as unknown as Anthropic;
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'teach me' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(streamFn).toHaveBeenCalledTimes(2);
      expect(getConv().messages.at(-1)?.content).toBe("Let's begin.");
    });
  });

  describe('tool_use round-trips', () => {
    it('normalizes finalMessage content into text/tool_use blocks and sets message kind to tool-use', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me check.' },
          { type: 'tool_use', id: 'tu_1', name: 'get_spec_docs', input: { kinds: ['chalk-graph'] } },
        ],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'Here you go.' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({ executeSkill: () => 'docs for chalk-graph' });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      const toolUseMsg = getConv().messages[1];
      expect(toolUseMsg.kind).toBe('tool-use');
      expect(toolUseMsg.content).toEqual([
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', id: 'tu_1', name: 'get_spec_docs', input: { kinds: ['chalk-graph'] } },
      ]);
    });

    it('calls agent.executeSkill with the tool name and input for each tool_use block', async () => {
      const executeSkill = vi.fn(() => 'result');
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'get_spec_docs', input: { kinds: ['chalk-graph'] } }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({ executeSkill });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(executeSkill).toHaveBeenCalledWith('get_spec_docs', { kinds: ['chalk-graph'] });
    });

    it('pushes a tool-result user message with one tool_result block per tool_use call, in order', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'a', input: {} },
          { type: 'tool_use', id: 'tu_2', name: 'b', input: {} },
        ],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({ executeSkill: (name) => `result-${name}` });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      const toolResultMsg = getConv().messages[2];
      expect(toolResultMsg.kind).toBe('tool-result');
      expect(toolResultMsg.role).toBe('user');
      expect(toolResultMsg.content).toEqual([
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'result-a' },
        { type: 'tool_result', tool_use_id: 'tu_2', content: 'result-b' },
      ]);
    });

    it('reports "Unknown tool: <name>" as tool_result content when executeSkill is undefined', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'mystery', input: {} }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({ executeSkill: undefined });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[2].content).toEqual([
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'Unknown tool: mystery' },
      ]);
    });

    it('reports "Unknown tool: <name>" as tool_result content when executeSkill has no handler for that name', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'mystery', input: {} }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({
        executeSkill: (name) => (name === 'get_spec_docs' ? 'docs' : (undefined as unknown as string)),
      });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[2].content).toEqual([
        { type: 'tool_result', tool_use_id: 'tu_1', content: 'Unknown tool: mystery' },
      ]);
    });

    it('makes a follow-up API call (continues the round loop) after a tool_use round', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'x', input: {} }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const streamFn = vi
        .fn()
        .mockReturnValueOnce(makeStream([], toolUseFinal))
        .mockReturnValueOnce(makeStream([], terminalFinal));
      const client = { messages: { stream: streamFn } } as unknown as Anthropic;
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(streamFn).toHaveBeenCalledTimes(2);
    });

    it('resolves normally once a follow-up round returns a terminal (non tool_use) response', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [{ type: 'tool_use', id: 'tu_1', name: 'x', input: {} }],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream(['done'], terminalFinal)]);
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      let errorState: string | null = 'unset';
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: (e) => { errorState = e; }, client },
      );
      expect(errorState).toBeNull();
      expect(getConv().messages.at(-1)?.content).toBe('done');
    });

    it('handles multiple tool_use blocks within a single assistant turn', async () => {
      const executeSkill = vi.fn((name: string) => `result-${name}`);
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tu_1', name: 'a', input: {} },
          { type: 'tool_use', id: 'tu_2', name: 'b', input: {} },
          { type: 'tool_use', id: 'tu_3', name: 'c', input: {} },
        ],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({ executeSkill });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(executeSkill).toHaveBeenCalledTimes(3);
      expect(getConv().messages[1].toolUseData?.calls).toHaveLength(3);
    });

    it('leaves conversation.plans untouched for a tool_use round that does not call set_lesson_plan', async () => {
      const toolUseFinal = makeFinalMessage({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Let me look that up.' },
          { type: 'tool_use', id: 'tu_1', name: 'x', input: {} },
        ],
      });
      const terminalFinal = makeFinalMessage({ content: [{ type: 'text', text: 'done' }] });
      const client = fakeClientSequence([makeStream([], toolUseFinal), makeStream([], terminalFinal)]);
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().plans).toEqual([]);
      expect(getConv().messages[1].content).toEqual([
        { type: 'text', text: 'Let me look that up.' },
        { type: 'tool_use', id: 'tu_1', name: 'x', input: {} },
      ]);
    });
  });

  describe('MAX_TOOL_ROUNDS enforcement', () => {
    it('stops after MAX_TOOL_ROUNDS consecutive tool_use rounds without a terminal reply', async () => {
      const streamFn = vi.fn(() =>
        makeStream([], makeFinalMessage({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu', name: 'x', input: {} }] })),
      );
      const client = { messages: { stream: streamFn } } as unknown as Anthropic;
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(streamFn).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS);
    });

    it('sets a user-facing error message when MAX_TOOL_ROUNDS is exceeded', async () => {
      const client = fakeClient(() =>
        makeStream([], makeFinalMessage({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu', name: 'x', input: {} }] })),
      );
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      let errorState: string | null = null;
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: (e) => { errorState = e; }, client },
      );
      expect(errorState).toContain('too many tool calls');
    });

    it('still persists conversation state when MAX_TOOL_ROUNDS is exceeded', async () => {
      const persist = vi.fn();
      const client = fakeClient(() =>
        makeStream([], makeFinalMessage({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu', name: 'x', input: {} }] })),
      );
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client, persist },
      );
      expect(persist).toHaveBeenCalled();
    });

    it('does not exceed MAX_TOOL_ROUNDS API calls even if the mock always returns tool_use', async () => {
      let callCount = 0;
      const streamFn = vi.fn(() => {
        callCount++;
        return makeStream([], makeFinalMessage({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: `tu_${callCount}`, name: 'x', input: {} }] }));
      });
      const client = { messages: { stream: streamFn } } as unknown as Anthropic;
      const agent = makeAgent({ executeSkill: () => 'ok' });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent, getConv, setConv, onError: () => {}, client },
      );
      expect(callCount).toBe(MAX_TOOL_ROUNDS);
    });
  });

  describe('error handling', () => {
    it('sets the error message when the Anthropic client throws synchronously', async () => {
      const client = {
        messages: {
          stream: () => {
            throw new Error('boom');
          },
        },
      } as unknown as Anthropic;
      let errorState: string | null = null;
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: (e) => { errorState = e; }, client },
      );
      expect(errorState).toBe('boom');
    });

    it('sets the error message when the stream rejects asynchronously mid-iteration', async () => {
      const client = fakeClient(() => makeErrorStream(new Error('stream failed'), ['partial']));
      let errorState: string | null = null;
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: (e) => { errorState = e; }, client },
      );
      expect(errorState).toBe('stream failed');
    });

    it('retains the partial assistant message content already streamed before the error', async () => {
      const client = fakeClient(() => makeErrorStream(new Error('stream failed'), ['partial']));
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(getConv().messages[1].content).toBe('partial');
    });

    it('persists conversation state after an error', async () => {
      const persist = vi.fn();
      const client = {
        messages: {
          stream: () => {
            throw new Error('boom');
          },
        },
      } as unknown as Anthropic;
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client, persist },
      );
      expect(persist).toHaveBeenCalled();
    });

    it('clears any previous error at the start of a new call', async () => {
      const calls: Array<string | null> = [];
      const onError = (e: string | null) => calls.push(e);
      const client = fakeClient(() => makeStream([], makeFinalMessage()));
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError, client },
      );
      expect(calls[0]).toBeNull();
    });
  });

  describe('tools wiring', () => {
    it('omits the tools param entirely when agent.skills is empty', async () => {
      let capturedParams: { tools?: unknown } | undefined;
      const client = fakeClient((params) => {
        capturedParams = params as typeof capturedParams;
        return makeStream([], makeFinalMessage());
      });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent({ skills: [] }), getConv, setConv, onError: () => {}, client },
      );
      expect(capturedParams!.tools).toBeUndefined();
    });

    it('passes agent.skills as the tools param when non-empty', async () => {
      let capturedParams: { tools?: unknown } | undefined;
      const skills = [{ name: 'get_spec_docs', description: 'd', input_schema: { type: 'object', properties: {}, required: [] } }];
      const client = fakeClient((params) => {
        capturedParams = params as typeof capturedParams;
        return makeStream([], makeFinalMessage());
      });
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent({ skills }), getConv, setConv, onError: () => {}, client },
      );
      expect(capturedParams!.tools).toEqual(skills);
    });
  });

  describe('client injection', () => {
    it('uses the injected deps.client instead of constructing one via makeClient when provided', async () => {
      const client = fakeClient(() => makeStream([], makeFinalMessage()));
      const { getConv, setConv } = makeConvStore();
      await sendMessage(
        { role: 'user', content: 'hi' },
        { apiKey: 'k', agent: makeAgent(), getConv, setConv, onError: () => {}, client },
      );
      expect(makeClient).not.toHaveBeenCalled();
    });
  });
});

// --- message builders -----------------------------------------------------

describe('buildGraphClickMessage', () => {
  it('produces a singular "I clicked the point (x, y)" summary for exactly one point', () => {
    const msg = buildGraphClickMessage([{ x: 1, y: 2 }]);
    expect(msg.content).toBe('I clicked the point (1, 2) on the graph.');
  });

  it('produces a bulleted multi-point summary for more than one point', () => {
    const msg = buildGraphClickMessage([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    expect(msg.content).toBe('I clicked the following points on the graph:\n- (1, 2)\n- (3, 4)');
  });

  it('sets kind to graph-click and preserves the raw points array in graphClickData', () => {
    const points = [{ x: 1, y: 2 }];
    const msg = buildGraphClickMessage(points);
    expect(msg.kind).toBe('graph-click');
    expect(msg.graphClickData).toEqual({ points });
  });
});

describe('buildDrawSubmissionMessage', () => {
  it('produces a content array with a leading text block and a base64 image block', () => {
    const msg = buildDrawSubmissionMessage('AAAA');
    expect(msg.content).toEqual([
      { type: 'text', text: 'Here is my drawing:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
    ]);
  });

  it('sets kind to draw-submission and preserves the raw base64 string in drawSubmissionData', () => {
    const msg = buildDrawSubmissionMessage('AAAA');
    expect(msg.kind).toBe('draw-submission');
    expect(msg.drawSubmissionData).toEqual({ imageBase64: 'AAAA' });
  });
});

describe('buildAnswerSubmitMessage', () => {
  it('produces a bulleted "- identifier: value" summary line per answer', () => {
    const msg = buildAnswerSubmitMessage({ q1: 'a', q2: 'b' });
    expect(msg.content).toBe("I've filled in my answers:\n- q1: a\n- q2: b");
  });

  it('sets kind to answer-submit and preserves the raw answers map in answerData', () => {
    const answers = { q1: 'a' };
    const msg = buildAnswerSubmitMessage(answers);
    expect(msg.kind).toBe('answer-submit');
    expect(msg.answerData).toEqual({ answers });
  });
});
