import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock import.meta.env before importing modules that read it
vi.stubGlobal('import', { meta: { env: {} } });

// crypto.randomUUID is available in Node 14.17+ but let's ensure it's present
if (!globalThis.crypto) {
  // @ts-expect-error polyfill for test env
  globalThis.crypto = await import('node:crypto').then((m) => m.webcrypto);
}

// localStorage is not available in node env — stub it
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
});

const {
  newConversation,
  forkConversation,
  revertConversation,
  getChildMap,
  extractPlanBlock,
  deriveTitle,
  upsertConversation,
  getAllConversations,
} = await import('./conversations');

const DEFAULT_MODEL = 'claude-sonnet-4-6';

function makeMessage(role: 'user' | 'assistant', content: string) {
  return { id: crypto.randomUUID(), role, content };
}

describe('newConversation', () => {
  it('defaults model to DEFAULT_MODEL', () => {
    const conv = newConversation();
    expect(conv.model).toBe(DEFAULT_MODEL);
  });

  it('accepts an explicit model', () => {
    const conv = newConversation('claude-opus-4-7');
    expect(conv.model).toBe('claude-opus-4-7');
  });

  it('starts with empty plans and no provenance', () => {
    const conv = newConversation();
    expect(conv.plans).toEqual([]);
    expect(conv.provenance).toBeUndefined();
  });

  it('has a unique id each time', () => {
    const a = newConversation();
    const b = newConversation();
    expect(a.id).not.toBe(b.id);
  });
});

describe('forkConversation', () => {
  const source = {
    ...newConversation(),
    messages: [
      makeMessage('user', 'hello'),
      makeMessage('assistant', 'hi'),
      makeMessage('user', 'more'),
    ],
    plans: ['plan v1'],
  };

  it('slices messages up to and including the given index', () => {
    const fork = forkConversation(source, 1);
    expect(fork.messages.length).toBe(2);
    expect(fork.messages[0].content).toBe('hello');
    expect(fork.messages[1].content).toBe('hi');
  });

  it('sets correct provenance', () => {
    const fork = forkConversation(source, 1);
    expect(fork.provenance?.parentId).toBe(source.id);
    expect(fork.provenance?.forkMessageIndex).toBe(1);
  });

  it('copies plans from source', () => {
    const fork = forkConversation(source, 0);
    expect(fork.plans).toEqual(['plan v1']);
  });

  it('gets a new unique id', () => {
    const fork = forkConversation(source, 0);
    expect(fork.id).not.toBe(source.id);
  });

  it('inherits model from source', () => {
    const src = { ...newConversation('claude-opus-4-7'), messages: [makeMessage('user', 'x')] };
    const fork = forkConversation(src, 0);
    expect(fork.model).toBe('claude-opus-4-7');
  });
});

describe('revertConversation', () => {
  const conv = {
    ...newConversation(),
    messages: [
      makeMessage('user', 'a'),
      makeMessage('assistant', 'b'),
      makeMessage('user', 'c'),
      makeMessage('assistant', 'd'),
    ],
    updatedAt: 1000,
  };

  it('slices messages up to and including the given index', () => {
    const reverted = revertConversation(conv, 1);
    expect(reverted.messages.length).toBe(2);
    expect(reverted.messages[1].content).toBe('b');
  });

  it('updates updatedAt', () => {
    const before = Date.now();
    const reverted = revertConversation(conv, 1);
    expect(reverted.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('does not mutate the original', () => {
    revertConversation(conv, 0);
    expect(conv.messages.length).toBe(4);
  });
});

describe('getChildMap', () => {
  it('groups forks by parentId', () => {
    const parent = newConversation();
    const child1 = { ...newConversation(), provenance: { parentId: parent.id, forkMessageIndex: 0 } };
    const child2 = { ...newConversation(), provenance: { parentId: parent.id, forkMessageIndex: 2 } };
    const unrelated = newConversation();

    const map = getChildMap([parent, child1, child2, unrelated]);
    expect(map.get(parent.id)).toHaveLength(2);
    expect(map.get(unrelated.id)).toBeUndefined();
  });

  it('returns empty map for conversations with no children', () => {
    const map = getChildMap([newConversation()]);
    expect(map.size).toBe(0);
  });
});

describe('extractPlanBlock', () => {
  it('returns null plan when no >>PLAN<< marker', () => {
    const result = extractPlanBlock('just a normal reply');
    expect(result.plan).toBeNull();
    expect(result.reply).toBe('just a normal reply');
  });

  it('extracts plan and reply when both present', () => {
    const content = '>>PLAN<<\n# Goals\n- learn math\n>>END PLAN<<\n\nHere is your lesson!';
    const result = extractPlanBlock(content);
    expect(result.plan).toBe('# Goals\n- learn math');
    expect(result.reply).toBe('Here is your lesson!');
  });

  it('handles plan with no following reply', () => {
    const content = '>>PLAN<<\n# Plan content\n>>END PLAN<<';
    const result = extractPlanBlock(content);
    expect(result.plan).toBe('# Plan content');
    expect(result.reply).toBe('');
  });

  it('handles >>PLAN<< with no >>END PLAN<< terminator', () => {
    const content = 'preamble\n>>PLAN<<\n# Plan without end';
    const result = extractPlanBlock(content);
    expect(result.plan).toBe('# Plan without end');
    expect(result.reply).toBe('preamble');
  });
});

describe('deriveTitle', () => {
  it('returns "New conversation" when no messages', () => {
    expect(deriveTitle([])).toBe('New conversation');
  });

  it('uses first user message, truncated to 60 chars', () => {
    const long = 'a'.repeat(80);
    expect(deriveTitle([makeMessage('user', long)])).toBe('a'.repeat(60) + '…');
  });

  it('does not truncate short messages', () => {
    expect(deriveTitle([makeMessage('user', 'hi')])).toBe('hi');
  });
});

describe('migration', () => {
  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it('normalizes old conversations missing model and plans', () => {
    const oldConv = {
      id: 'old-1',
      title: 'Old conv',
      createdAt: 1000,
      updatedAt: 1000,
      messages: [],
      // no model, no plans
    };
    store['chalk.conversations'] = JSON.stringify({ 'old-1': oldConv });

    const convs = getAllConversations();
    expect(convs[0].model).toBe(DEFAULT_MODEL);
    expect(convs[0].plans).toEqual([]);
  });

  it('normalizes messages missing id field', () => {
    const oldConv = {
      id: 'old-2',
      title: 'Old conv',
      createdAt: 1000,
      updatedAt: 1000,
      messages: [{ role: 'user', content: 'hello' }],
    };
    store['chalk.conversations'] = JSON.stringify({ 'old-2': oldConv });

    const convs = getAllConversations();
    expect(convs[0].messages[0].id).toBeTruthy();
  });
});
