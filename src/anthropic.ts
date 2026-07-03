import Anthropic from '@anthropic-ai/sdk';

const KEY_STORAGE = 'ganita.anthropic_api_key';
const ENV_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export const AVAILABLE_MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number];

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

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  modifiedFromRawMessage?: string;
};
