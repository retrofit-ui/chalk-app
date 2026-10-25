import type { Accessor } from 'solid-js';
import type { SetStoreFunction } from 'solid-js/store';
import { produce } from 'solid-js/store';
import type Anthropic from '@anthropic-ai/sdk';
import {
  DEFAULT_EFFORT,
  DEFAULT_MODEL,
  estimateCost,
  makeClient,
  thinkingConfig,
  type ChatMessage,
  type ContentBlock,
  type GraphClickPoint,
} from './anthropic';
import { deriveTitle, type Conversation } from './conversations';
import type { Agent } from './agents/types';
import { formatClickPoint } from './agents/ada/coords';

export const MAX_TOOL_ROUNDS = 4;

// Handled directly here (not delegated to agent.executeSkill) because setting the plan is a
// side effect on conversation state, which executeSkill — a stateless string-in/string-out
// function — has no access to. Any agent that wants plan support declares this in its own
// `skills` array (see agents/ada, agents/bernoulli); the execution is agent-agnostic.
const SET_LESSON_PLAN_TOOL = 'set_lesson_plan';

export type SendMessageDeps = {
  apiKey: string;
  agent: Agent;
  getConv: Accessor<Conversation>;
  setConv: SetStoreFunction<Conversation>;
  onError: (message: string | null) => void;
  /** Injectable Anthropic client — defaults to makeClient(apiKey). Tests supply a mock here. */
  client?: Anthropic;
  /** Called wherever the original App.tsx called upsertConversation({...activeConv}). */
  persist?: (conv: Conversation) => void;
  /** Called only right after the user message is pushed (mirrors the original's setActiveId call there). */
  setActiveId?: (id: string) => void;
  /** Called after the user-message push and after a successful terminal turn (mirrors the original's refreshList calls). */
  refreshList?: () => void;
};

/**
 * Runs one full user turn: pushes the user message, then loops assistant rounds
 * (streaming text, handling tool_use round-trips) until a terminal reply or
 * MAX_TOOL_ROUNDS is hit. Ported out of App.tsx's sendMessage closure so it can be
 * driven directly in tests against a mocked Anthropic client.
 */
export async function sendMessage(userMsg: Omit<ChatMessage, 'id'>, deps: SendMessageDeps): Promise<void> {
  const { apiKey, agent, getConv, setConv, onError, persist, setActiveId, refreshList } = deps;
  const client = deps.client ?? makeClient(apiKey);

  onError(null);

  const userMsgId = crypto.randomUUID();

  setConv('messages', produce((m: ChatMessage[]) => {
    m.push({ id: userMsgId, ...userMsg });
  }));

  if (getConv().messages.length === 1) {
    setConv('title', deriveTitle(getConv().messages));
  }

  setConv('updatedAt', Date.now());
  persist?.({ ...getConv() });
  setActiveId?.(getConv().id);
  refreshList?.();

  try {
    const model = getConv().model ?? DEFAULT_MODEL;
    const thinking = thinkingConfig(model, getConv().effort ?? DEFAULT_EFFORT);
    const tools = agent.skills.length > 0 ? (agent.skills as never) : undefined;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const assistantMsgId = crypto.randomUUID();
      setConv('messages', produce((m: ChatMessage[]) => {
        m.push({ id: assistantMsgId, role: 'assistant', content: '' });
      }));
      const assistantIdx = getConv().messages.length - 1;

      const priorMessages = getConv().messages.slice(0, assistantIdx);
      const lastIdx = priorMessages.length - 1;
      // The pinned SDK predates adaptive thinking and effort, so those fields go in untyped.
      const stream = client.messages.stream({
        ...(thinking.params as object),
        model,
        max_tokens: 32000,
        system: [
          {
            type: 'text',
            text: agent.systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools,
        messages: priorMessages.map((m, i) => {
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
      } as Parameters<typeof client.messages.stream>[0],
      thinking.betas.length > 0 ? { headers: { 'anthropic-beta': thinking.betas.join(',') } } : undefined);

      // While streaming, content is the visible text so far: text plus thinking-block
      // progress notes, a blank line between blocks.
      let blockStarted = false;
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          blockStarted = true;
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta as { type: string; text?: string; thinking?: string };
          const piece = delta.type === 'text_delta' ? delta.text : delta.type === 'thinking_delta' ? delta.thinking : undefined;
          if (!piece) continue;
          const separate = blockStarted;
          blockStarted = false;
          setConv('messages', assistantIdx, 'content', (c) => {
            const text = c as string;
            return (separate && text ? text + '\n\n' : text) + piece;
          });
        }
      }

      const finalMsg = await stream.finalMessage();
      const u = finalMsg.usage;
      console.log(
        `[cache] round=${round} input=${u.input_tokens} write=${u.cache_creation_input_tokens ?? 0} read=${u.cache_read_input_tokens ?? 0}`,
      );

      const turnCost = estimateCost(model, u);
      setConv('usage', (prev) => ({
        inputTokens: (prev?.inputTokens ?? 0) + u.input_tokens,
        outputTokens: (prev?.outputTokens ?? 0) + u.output_tokens,
        cacheCreationTokens: (prev?.cacheCreationTokens ?? 0) + (u.cache_creation_input_tokens ?? 0),
        cacheReadTokens: (prev?.cacheReadTokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        costUsd: (prev?.costUsd ?? 0) + turnCost,
      }));

      setConv('messages', assistantIdx, 'debug', {
        estimatedCostUsd: turnCost,
        usage: finalMsg.usage,
        id: finalMsg.id,
        model: finalMsg.model,
        role: finalMsg.role,
        type: finalMsg.type,
        stop_reason: finalMsg.stop_reason,
        stop_sequence: finalMsg.stop_sequence,
      });

      if (finalMsg.stop_reason) {
        setConv('messages', assistantIdx, 'stopReason', finalMsg.stop_reason);
      }
      setConv('messages', assistantIdx, 'model', model);

      // Keep every block the API needs back, thinking blocks included, unchanged: the next
      // request must replay them as they came or the model loses its reasoning. A reply
      // that is only text stays the streamed string.
      const blocks = (finalMsg.content as unknown as Array<{ type: string } & Record<string, unknown>>).flatMap(
        (b): ContentBlock[] => {
          if (b.type === 'text') return [{ type: 'text', text: b.text as string }];
          if (b.type === 'tool_use') {
            return [{ type: 'tool_use', id: b.id as string, name: b.name as string, input: b.input }];
          }
          if (b.type === 'thinking') {
            return [{ type: 'thinking', thinking: b.thinking as string, signature: b.signature as string }];
          }
          if (b.type === 'redacted_thinking') return [{ type: 'redacted_thinking', data: b.data as string }];
          return [];
        },
      );
      if (blocks.some((b) => b.type !== 'text')) {
        setConv('messages', assistantIdx, 'content', blocks);
      }

      if (finalMsg.stop_reason === 'tool_use') {
        const toolUseBlocks = finalMsg.content.filter(
          (b): b is { type: 'tool_use'; id: string; name: string; input: unknown } => b.type === 'tool_use',
        );

        setConv('messages', assistantIdx, {
          kind: 'tool-use',
          toolUseData: { calls: toolUseBlocks.map((b) => ({ id: b.id, name: b.name, input: b.input })) },
        });

        const resultBlocks = toolUseBlocks.map((b) => {
          if (b.name === SET_LESSON_PLAN_TOOL) {
            const plan = (b.input as { plan?: unknown } | undefined)?.plan;
            if (typeof plan !== 'string' || !plan.trim()) {
              return {
                type: 'tool_result' as const,
                tool_use_id: b.id,
                content: 'Invalid input: "plan" must be a non-empty string.',
              };
            }
            setConv('plans', produce((ps: string[]) => { ps.push(plan); }));
            return { type: 'tool_result' as const, tool_use_id: b.id, content: 'Plan saved.' };
          }
          return {
            type: 'tool_result' as const,
            tool_use_id: b.id,
            content: agent.executeSkill?.(b.name, b.input) ?? `Unknown tool: ${b.name}`,
          };
        });

        setConv('messages', produce((m: ChatMessage[]) => {
          m.push({ id: crypto.randomUUID(), role: 'user', content: resultBlocks, kind: 'tool-result' });
        }));

        continue;
      }

      setConv('updatedAt', Date.now());
      persist?.({ ...getConv() });
      refreshList?.();
      return;
    }

    onError('Ada made too many tool calls in a row without replying — stopped after 4 rounds.');
    setConv('updatedAt', Date.now());
    persist?.({ ...getConv() });
  } catch (err) {
    onError(err instanceof Error ? err.message : String(err));
    // Keep the partial/errored assistant message so it stays inspectable via the "raw" toggle.
    setConv('updatedAt', Date.now());
    persist?.({ ...getConv() });
  }
}

export function buildGraphClickMessage(points: GraphClickPoint[]): Omit<ChatMessage, 'id'> {
  const summary = points.length === 1
    ? `I clicked the point ${formatClickPoint(points[0])} on the graph.`
    : `I clicked the following points on the graph:\n${points.map((p) => `- ${formatClickPoint(p)}`).join('\n')}`;
  return {
    role: 'user',
    content: summary,
    kind: 'graph-click',
    graphClickData: { points },
  };
}

export function buildDrawSubmissionMessage(imageBase64: string): Omit<ChatMessage, 'id'> {
  return {
    role: 'user',
    content: [
      { type: 'text', text: 'Here is my drawing:' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
    ],
    kind: 'draw-submission',
    drawSubmissionData: { imageBase64 },
  };
}

export function buildAnswerSubmitMessage(answers: Record<string, string>): Omit<ChatMessage, 'id'> {
  const summary = Object.entries(answers).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  return {
    role: 'user',
    content: `I've filled in my answers:\n${summary}`,
    kind: 'answer-submit',
    answerData: { answers },
  };
}
