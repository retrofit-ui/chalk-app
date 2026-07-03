import { DEFAULT_MODEL } from './anthropic';
import type { ChatMessage } from './anthropic';

export type Conversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model: string;
  plans: string[];
  provenance?: {
    parentId: string;
    forkMessageIndex: number;
  };
};

const CONV_STORAGE = 'chalk.conversations';
const ACTIVE_ID_KEY = 'chalk.activeConvId';

function normalize(conv: Conversation): Conversation {
  return {
    model: DEFAULT_MODEL,
    plans: [],
    ...conv,
    messages: conv.messages.map((m) => ({
      id: crypto.randomUUID(),
      ...m,
    })),
  };
}

function loadAll(): Record<string, Conversation> {
  try {
    const raw = localStorage.getItem(CONV_STORAGE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Record<string, Conversation> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = normalize(v as Conversation);
    }
    return result;
  } catch {
    return {};
  }
}

function saveAll(all: Record<string, Conversation>): void {
  localStorage.setItem(CONV_STORAGE, JSON.stringify(all));
}

export function getAllConversations(): Conversation[] {
  return Object.values(loadAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | null {
  return loadAll()[id] ?? null;
}

export function upsertConversation(conv: Conversation): void {
  const all = loadAll();
  all[conv.id] = conv;
  saveAll(all);
}

export function deleteConversation(id: string): void {
  const all = loadAll();
  delete all[id];
  saveAll(all);
}

export function newConversation(model?: string): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    model: model ?? DEFAULT_MODEL,
    plans: [],
  };
}

export function forkConversation(source: Conversation, messageIndex: number): Conversation {
  return {
    id: crypto.randomUUID(),
    title: source.title + ' (fork)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: source.messages.slice(0, messageIndex + 1),
    model: source.model,
    plans: [...source.plans],
    provenance: {
      parentId: source.id,
      forkMessageIndex: messageIndex,
    },
  };
}

export function revertConversation(conv: Conversation, messageIndex: number): Conversation {
  return {
    ...conv,
    messages: conv.messages.slice(0, messageIndex + 1),
    updatedAt: Date.now(),
  };
}

export function getChildMap(convs: Conversation[]): Map<string, Conversation[]> {
  const map = new Map<string, Conversation[]>();
  for (const conv of convs) {
    if (conv.provenance) {
      const { parentId } = conv.provenance;
      const existing = map.get(parentId) ?? [];
      existing.push(conv);
      map.set(parentId, existing);
    }
  }
  return map;
}

const PLAN_START = '>>PLAN<<';
const PLAN_END = '>>END PLAN<<';

export function extractPlanBlock(content: string): { plan: string | null; reply: string } {
  const startIdx = content.indexOf(PLAN_START);
  if (startIdx === -1) return { plan: null, reply: content };

  const afterStart = content.slice(startIdx + PLAN_START.length);
  const endIdx = afterStart.indexOf(PLAN_END);

  if (endIdx === -1) {
    // No terminator — treat everything after >>PLAN<< as the plan
    return { plan: afterStart.trim(), reply: content.slice(0, startIdx).trim() };
  }

  const plan = afterStart.slice(0, endIdx).trim();
  const reply = (content.slice(0, startIdx) + afterStart.slice(endIdx + PLAN_END.length)).trim();
  return { plan, reply };
}

export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New conversation';
  const raw = typeof first.content === 'string'
    ? first.content
    : (first.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined)?.text ?? 'Drawing';
  const text = raw.slice(0, 60).trim();
  return raw.length > 60 ? text + '…' : text;
}

export function getActiveId(): string | null {
  return sessionStorage.getItem(ACTIVE_ID_KEY);
}

export function setActiveId(id: string): void {
  sessionStorage.setItem(ACTIVE_ID_KEY, id);
}

export function clearActiveId(): void {
  sessionStorage.removeItem(ACTIVE_ID_KEY);
}

export type DateGroup = 'Today' | 'Yesterday' | 'Last 7 days' | 'Last 30 days' | 'Older';

export const DATE_GROUPS: DateGroup[] = [
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last 30 days',
  'Older',
];

export function groupConversations(
  convs: Conversation[],
): Record<DateGroup, Conversation[]> {
  const now = Date.now();
  const startToday = startOfDay(now);
  const startYesterday = startToday - 86_400_000;
  const start7 = startToday - 6 * 86_400_000;
  const start30 = startToday - 29 * 86_400_000;

  const groups: Record<DateGroup, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 days': [],
    'Last 30 days': [],
    Older: [],
  };

  for (const conv of convs) {
    const t = conv.updatedAt;
    if (t >= startToday) groups.Today.push(conv);
    else if (t >= startYesterday) groups.Yesterday.push(conv);
    else if (t >= start7) groups['Last 7 days'].push(conv);
    else if (t >= start30) groups['Last 30 days'].push(conv);
    else groups.Older.push(conv);
  }

  return groups;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
