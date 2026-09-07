import Anthropic from '@anthropic-ai/sdk';

const KEY_STORAGE = 'chalk.api_key';
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export const AVAILABLE_MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number];

// $ per million tokens. Cache writes are 1.25x base input; cache reads are 0.1x base input.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
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
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
  const cacheWriteCost = ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) * pricing.input * 1.25;
  const cacheReadCost = ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * pricing.input * 0.1;
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
export type MessageContent = string | Array<TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock>;

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
