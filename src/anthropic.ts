import Anthropic from '@anthropic-ai/sdk';

const KEY_STORAGE = 'chalk.api_key';
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export const AVAILABLE_MODELS = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number];

export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];
export const DEFAULT_EFFORT: Effort = 'low';

// Opus and Sonnet 5.5 return the notes they write between tool calls as thinking blocks,
// empty unless the request asks for `display: 'updates'` under this beta.
export const THINKING_UPDATES_BETA = 'thinking-display-updates-2026-08-18';
const UPDATES_MODELS: ReadonlySet<string> = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

/**
 * Whether `model` gets adaptive thinking and an effort level. Older models (still set on
 * conversations saved before the 5.5 upgrade) get neither, so their requests are unchanged.
 */
export function supportsEffort(model: string): boolean {
  return (AVAILABLE_MODELS as readonly string[]).includes(model);
}

/** Request fields and beta headers that turn on thinking for `model` at `effort`. */
export function thinkingConfig(model: string, effort: Effort): { params: Record<string, unknown>; betas: string[] } {
  if (!supportsEffort(model)) return { params: {}, betas: [] };
  const updates = UPDATES_MODELS.has(model);
  return {
    params: {
      thinking: updates ? { type: 'adaptive', display: 'updates' } : { type: 'adaptive' },
      output_config: { effort },
    },
    betas: updates ? [THINKING_UPDATES_BETA] : [],
  };
}

// $ per million tokens. Cache writes are 1.25x base input; cache reads are `cacheRead` x base
// input (0.1x unless noted). `longPrompt` is a second rate card for prompts over `over` tokens.
type Pricing = {
  input: number;
  output: number;
  cacheRead?: number;
  longPrompt?: { over: number; input: number; output: number };
};
const MODEL_PRICING: Record<string, Pricing> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.05 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, longPrompt: { over: 100_000, input: 0.5, output: 2.5 } },
  // Pre-5.5 models, kept so older conversations still cost out correctly.
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
};

export function estimateCost(
  model: string,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
): number {
  const base = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const promptTokens = usage.input_tokens + cacheWrite + cacheRead;
  const rates = base.longPrompt && promptTokens > base.longPrompt.over ? base.longPrompt : base;
  const inputCost = (usage.input_tokens / 1_000_000) * rates.input;
  const outputCost = (usage.output_tokens / 1_000_000) * rates.output;
  const cacheWriteCost = (cacheWrite / 1_000_000) * rates.input * 1.25;
  const cacheReadCost = (cacheRead / 1_000_000) * rates.input * (base.cacheRead ?? 0.1);
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export function getStoredKey(): string | null {
  // Build-time env var takes priority — skips the key-gate entirely.
  if (ENV_KEY) return ENV_KEY;
  return localStorage.getItem(KEY_STORAGE);
}

export function setStoredKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key);
}

export function clearStoredKey(): void {
  if (ENV_KEY) return;
  localStorage.removeItem(KEY_STORAGE);
}

export function isKeyFromEnv(): boolean {
  return Boolean(ENV_KEY);
}

export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export type TextBlock = { type: 'text'; text: string };
export type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };
export type ThinkingBlock = { type: 'thinking'; thinking: string; signature: string };
export type RedactedThinkingBlock = { type: 'redacted_thinking'; data: string };
export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock | ThinkingBlock | RedactedThinkingBlock;
export type MessageContent = string | ContentBlock[];

/**
 * The text a reader should see for `content`: text blocks plus any thinking-block progress
 * notes (non-empty only under `display: 'updates'`), in order. Signatures and tool calls are
 * for the API, not the reader.
 */
export function visibleText(content: MessageContent): string {
  if (typeof content === 'string') return content;
  return content
    .flatMap((b) => (b.type === 'text' ? [b.text] : b.type === 'thinking' && b.thinking.trim() ? [b.thinking] : []))
    .join('\n\n');
}

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: MessageContent;
  kind?: 'graph-click' | 'draw-submission' | 'answer-submit' | 'tool-use' | 'tool-result';
  graphClickData?: { points: Array<{ x: number; y: number }> };
  drawSubmissionData?: { imageBase64: string };
  answerData?: { answers: Record<string, string> };
  toolUseData?: { calls: Array<{ id: string; name: string; input: unknown }> };
  model?: string;
  stopReason?: string;
  debug?: Record<string, unknown>;
};
