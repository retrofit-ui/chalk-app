import type { Page } from '@playwright/test';
import type { Conversation } from '../../src/conversations';
import type { ChatMessage } from '../../src/anthropic';

// Storage keys mirror src/conversations.ts and src/anthropic.ts. They are
// duplicated here on purpose: the e2e layer must not import app modules that
// touch `localStorage` at import time, and a drift here fails loudly (the app
// simply renders nothing seeded).
export const KEY_STORAGE = 'chalk.api_key';
export const CONV_STORAGE = 'chalk.conversations';
export const ACTIVE_ID_KEY = 'chalk.activeConvId';

export const FAKE_API_KEY = 'sk-ant-e2e-fake-key';

export type SeedOptions = {
  /** Omit to leave the KeyGate up. */
  apiKey?: string | null;
  conversations?: Conversation[];
  /** Which conversation the app should open on load. */
  activeId?: string;
};

/**
 * Writes localStorage/sessionStorage before any app script runs, so the very
 * first render already sees the fixture conversation — no network involved.
 */
export async function seedApp(page: Page, opts: SeedOptions = {}): Promise<void> {
  const apiKey = opts.apiKey === undefined ? FAKE_API_KEY : opts.apiKey;
  const convs: Record<string, Conversation> = {};
  for (const c of opts.conversations ?? []) convs[c.id] = c;

  await page.addInitScript(
    ({ apiKey, convs, activeId, keys }) => {
      if (apiKey) localStorage.setItem(keys.KEY_STORAGE, apiKey);
      localStorage.setItem(keys.CONV_STORAGE, JSON.stringify(convs));
      if (activeId) sessionStorage.setItem(keys.ACTIVE_ID_KEY, activeId);
    },
    {
      apiKey,
      convs,
      activeId: opts.activeId,
      keys: { KEY_STORAGE, CONV_STORAGE, ACTIVE_ID_KEY },
    },
  );
}

let msgCounter = 0;

export function userMessage(content: string): ChatMessage {
  return { id: `u-${++msgCounter}`, role: 'user', content };
}

export function assistantMessage(content: string): ChatMessage {
  return { id: `a-${++msgCounter}`, role: 'assistant', content };
}

/** Wraps a spec in the ```chalk-spec fence the chunk parser recognises. */
export function specFence(spec: unknown): string {
  return '```chalk-spec\n' + JSON.stringify(spec) + '\n```';
}

export function conversation(id: string, messages: ChatMessage[], extra: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id,
    title: `Fixture ${id}`,
    createdAt: now,
    updatedAt: now,
    messages,
    model: 'claude-sonnet-4-6',
    agentId: 'ada',
    plans: [],
    ...extra,
  };
}

/** Seeds a single conversation whose only assistant turn renders `spec`, and opens it. */
export async function seedSpec(page: Page, spec: unknown, prompt = 'Show me'): Promise<void> {
  const conv = conversation('fixture', [
    userMessage(prompt),
    assistantMessage(specFence(spec)),
  ]);
  await seedApp(page, { conversations: [conv], activeId: conv.id });
}
