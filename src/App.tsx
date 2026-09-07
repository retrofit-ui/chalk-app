import { createEffect, createSignal, For, Show, type Component } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
  AVAILABLE_MODELS,
  clearStoredKey,
  getStoredKey,
  isKeyFromEnv,
  setStoredKey,
  type ChatMessage,
} from './anthropic';
import {
  forkConversation,
  getAllConversations,
  getActiveId,
  getChildMap,
  getConversation,
  newConversation,
  revertConversation,
  setActiveId,
  upsertConversation,
  type Conversation,
} from './conversations';
import { AGENTS, getAgent } from './agents/index';
import { findPreviousAnswers } from './agents/ada/harness';
import {
  sendMessage as runSendMessage,
  buildGraphClickMessage,
  buildDrawSubmissionMessage,
  buildAnswerSubmitMessage,
} from './chat';
import LessonPlan from './components/LessonPlan';
import MessageActions from './components/MessageActions';
import ReplyBox from './components/ReplyBox';
import DebugPanel from './components/DebugPanel';
import Sidebar from './Sidebar';
import { formatCost, formatTokens } from './format';

function resolveInitialConv(): Conversation {
  const savedId = getActiveId();
  if (savedId) {
    const conv = getConversation(savedId);
    if (conv) return conv;
  }
  return newConversation();
}

const App: Component = () => {
  const [apiKey, setApiKey] = createSignal<string | null>(getStoredKey());
  const [activeConv, setActiveConv] = createStore<Conversation>(resolveInitialConv());
  const [convList, setConvList] = createSignal<Conversation[]>(getAllConversations());
  const [input, setInput] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [planOpen, setPlanOpen] = createSignal(false);
  const [rawIds, setRawIds] = createSignal<Set<string>>(new Set());
  const toggleRaw = (index: number) => {
    const id = activeConv.messages[index]?.id;
    if (!id) return;
    setRawIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [debugIds, setDebugIds] = createSignal<Set<string>>(new Set());
  const toggleDebug = (index: number) => {
    const id = activeConv.messages[index]?.id;
    if (!id) return;
    setDebugIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const debugMessageCount = () => activeConv.messages.reduce((n, m) => n + (m.debug ? 1 : 0), 0);
  let textareaRef: HTMLTextAreaElement | undefined;
  let messagesRef: HTMLElement | undefined;

  createEffect(() => {
    // Track both message count and last message content (for streaming)
    void activeConv.messages.length;
    void activeConv.messages[activeConv.messages.length - 1]?.content;
    queueMicrotask(() => {
      if (messagesRef) messagesRef.scrollTop = messagesRef.scrollHeight;
    });
  });

  // Re-focus the textarea whenever the busy state clears (textarea re-enables after streaming)
  createEffect((wasBusy: boolean) => {
    const isBusy = busy();
    if (wasBusy && !isBusy) textareaRef?.focus();
    return isBusy;
  }, false);

  const refreshList = () => setConvList(getAllConversations());
  const childMap = () => getChildMap(convList());

  const saveKey = (key: string) => {
    setStoredKey(key);
    setApiKey(key);
  };

  const forgetKey = () => {
    clearStoredKey();
    setApiKey(null);
  };

  const activateConv = (conv: Conversation) => {
    setActiveConv(conv);
    setActiveId(conv.id);
    setError(null);
    setInput('');
    setPlanOpen(false);
  };

  const agent = () => getAgent(activeConv.agentId);

  const startNew = () => activateConv(newConversation(activeConv.model, activeConv.agentId));

  const selectConv = (conv: Conversation) => activateConv(conv);

  const selectExample = (example: Conversation) => {
    const conv = newConversation(activeConv.model, activeConv.agentId);
    conv.title = example.title;
    activateConv(conv);
    setInput(example.messages[0]?.content ?? '');
    setTimeout(() => textareaRef?.focus(), 0);
  };

  const setModel = (model: string) => {
    setActiveConv('model', model);
    upsertConversation({ ...activeConv });
  };

  const setAgentId = (id: string) => {
    setActiveConv('agentId', id);
    upsertConversation({ ...activeConv });
  };

  const forkFrom = (messageIndex: number) => {
    const forked = forkConversation({ ...activeConv }, messageIndex);
    upsertConversation(forked);
    activateConv(forked);
    refreshList();
    setTimeout(() => textareaRef?.focus(), 0);
  };

  const revertTo = (messageIndex: number) => {
    const msg = activeConv.messages[messageIndex];
    if (msg.role === 'user') {
      // Exclude this message from history; restore its text to the composer for editing
      const reverted = revertConversation({ ...activeConv }, messageIndex - 1);
      setActiveConv(reverted);
      upsertConversation(reverted);
      setInput(msg.content);
      setTimeout(() => textareaRef?.focus(), 0);
    } else {
      // Keep up to and including this assistant message; nudge user to reply
      const reverted = revertConversation({ ...activeConv }, messageIndex);
      setActiveConv(reverted);
      upsertConversation(reverted);
      setTimeout(() => textareaRef?.focus(), 0);
    }
    refreshList();
  };

  const updatePlan = (text: string) => {
    setActiveConv('plans', produce((ps: string[]) => { ps.push(text); }));
    upsertConversation({ ...activeConv });
  };

  const sendMessage = async (userMsg: Omit<ChatMessage, 'id'>) => {
    const key = apiKey();
    if (!key || busy()) return;

    setBusy(true);
    try {
      await runSendMessage(userMsg, {
        apiKey: key,
        agent: agent(),
        getConv: () => activeConv,
        setConv: setActiveConv,
        onError: setError,
        persist: (conv) => upsertConversation(conv),
        setActiveId,
        refreshList,
      });
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    const text = input().trim();
    if (!text) return;
    setInput('');
    void sendMessage({ role: 'user', content: text });
  };

  const onGraphClick = (points: Array<{ x: number; y: number }>) => {
    void sendMessage(buildGraphClickMessage(points));
  };

  const onDrawSubmit = (imageBase64: string) => {
    void sendMessage(buildDrawSubmissionMessage(imageBase64));
  };

  const onAnswerSubmit = (answers: Record<string, string>) => {
    void sendMessage(buildAnswerSubmitMessage(answers));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div class="flex h-screen overflow-hidden">
      <Show when={apiKey()} fallback={<KeyGate onSave={saveKey} />}>
        <Sidebar
          conversations={convList()}
          activeId={activeConv.id}
          childMap={childMap()}
          onNew={startNew}
          onSelect={selectConv}
          onSelectExample={selectExample}
        />

        <div class="flex-1 flex flex-col min-w-0">
          <header class="flex items-baseline gap-3 py-4 px-5 border-b border-gray-200 flex-shrink-0">
            <span class="text-sm font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{activeConv.title}</span>
            <button
              class="bg-transparent border-none text-[15px] text-gray-300 cursor-pointer py-0 px-0.5 leading-none flex-shrink-0 hover:text-gray-600"
              title="View lesson plan"
              onClick={() => setPlanOpen((o) => !o)}
            >
              {activeConv.plans.length > 0 ? 'ⓘ' : '○'}
            </button>
            <div class="flex items-baseline gap-2 flex-shrink-0">
              <select
                class="text-xs font-semibold text-gray-600 bg-transparent border-none cursor-pointer outline-none p-0 hover:text-gray-900 disabled:opacity-50 disabled:cursor-default"
                value={activeConv.agentId}
                onChange={(e) => setAgentId(e.currentTarget.value)}
                disabled={busy()}
              >
                <For each={AGENTS}>
                  {(a) => <option value={a.id}>{a.name}</option>}
                </For>
              </select>
              <select
                class="text-[11px] text-gray-300 font-mono bg-transparent border-none cursor-pointer outline-none p-0 hover:text-gray-400 disabled:opacity-50 disabled:cursor-default"
                value={activeConv.model}
                onChange={(e) => setModel(e.currentTarget.value)}
                disabled={busy()}
              >
                <For each={AVAILABLE_MODELS}>
                  {(m) => <option value={m}>{m}</option>}
                </For>
              </select>
            </div>
            <div class="ml-auto flex gap-3 flex-shrink-0">
              <Show when={activeConv.usage}>
                <span
                  class="text-xs text-gray-500 font-mono whitespace-nowrap cursor-default"
                  title={`${formatTokens(activeConv.usage!.inputTokens)} input, ${formatTokens(activeConv.usage!.outputTokens)} output, ${formatTokens(activeConv.usage!.cacheReadTokens)} cache read, ${formatTokens(activeConv.usage!.cacheCreationTokens)} cache write`}
                >
                  {formatCost(activeConv.usage!.costUsd)}
                  {' · '}
                  {formatTokens(
                    activeConv.usage!.inputTokens +
                    activeConv.usage!.outputTokens +
                    activeConv.usage!.cacheCreationTokens +
                    activeConv.usage!.cacheReadTokens,
                  )}
                  {' tokens'}
                </span>
              </Show>
              <Show when={!isKeyFromEnv()}>
                <button class="bg-transparent border-none text-gray-500 cursor-pointer text-sm p-0 hover:text-gray-700" onClick={forgetKey}>
                  clear key
                </button>
              </Show>
            </div>
          </header>

          <main ref={messagesRef} class="flex-1 overflow-y-auto py-6 px-5 flex flex-col gap-5">
            <Show when={activeConv.messages.length === 0 && !input()}>
              <div class="text-gray-300 text-center mt-15">Say something to {agent().name}.</div>
            </Show>
            <For each={activeConv.messages} keyed>
              {(m, index) => {
                const showDebug = () => debugIds().has(m.id) && Boolean(m.debug);
                const previousAnswers = () =>
                  m.kind === 'answer-submit'
                    ? findPreviousAnswers(activeConv.messages, index())
                    : undefined;
                const turnTokens = () => {
                  const u = m.debug?.usage as
                    | {
                        input_tokens?: number;
                        output_tokens?: number;
                        cache_creation_input_tokens?: number | null;
                        cache_read_input_tokens?: number | null;
                      }
                    | undefined;
                  if (!u) return undefined;
                  const fresh = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
                  const cached = u.cache_read_input_tokens ?? 0;
                  const output = u.output_tokens ?? 0;
                  return { total: fresh + cached + output, fresh, cached, output };
                };
                return (
                <Show when={m.kind !== 'tool-result'}>
                <div class="group flex flex-col gap-1 relative">
                  <div class="text-[11px] uppercase tracking-wider text-gray-400">
                    {m.role === 'assistant' ? agent().name.toLowerCase() : 'you'}
                    <Show when={m.model}>
                      <span class="text-[10px] text-gray-300 tracking-normal normal-case"> · {m.model}</span>
                    </Show>
                    <Show when={turnTokens()}>
                      {(t) => (
                        <span
                          class="text-[10px] text-gray-300 tracking-normal normal-case cursor-help"
                          title={`This reply: ${formatTokens(t().fresh)} fresh input + ${formatTokens(t().cached)} cache read + ${formatTokens(t().output)} output`}
                        >
                          {' '}· {formatTokens(t().total)} tok{t().cached > 0 ? ` (${formatTokens(t().cached)} cached)` : ''}
                        </span>
                      )}
                    </Show>
                    <Show when={m.stopReason && m.stopReason !== 'end_turn' && m.stopReason !== 'tool_use'}>
                      <span
                        class="ml-1.5 py-px px-1.5 rounded-sm bg-amber-100 text-amber-800 text-[10px] font-semibold tracking-normal normal-case border border-amber-300 cursor-help"
                        title={`Response ended with stop_reason: ${m.stopReason}`}
                      >
                        {m.stopReason === 'max_tokens' ? '⚠ truncated' : `⚠ ${m.stopReason}`}
                      </span>
                    </Show>
                  </div>
                  <div class={`relative ${showDebug() ? 'xl:flex xl:gap-4' : ''}`}>
                    <div class={`relative min-w-0 ${showDebug() ? 'xl:flex-[3_1_0%]' : ''}`}>
                      <Show
                        when={rawIds().has(m.id)}
                        fallback={
                          <Show
                            when={m.role === 'assistant'}
                            fallback={agent().Harness({ message: m, onGraphClick, onDrawSubmit, onAnswerSubmit, previousAnswers: previousAnswers() })}
                          >
                            <ReplyBox>
                              {agent().Harness({ message: m, onGraphClick, onDrawSubmit, onAnswerSubmit, previousAnswers: previousAnswers() })}
                            </ReplyBox>
                          </Show>
                        }
                      >
                        <pre class="m-0 p-3 bg-slate-900 text-slate-200 font-mono text-[0.8rem] leading-normal rounded-md overflow-x-auto whitespace-pre-wrap break-words">
                          {(() => {
                            const raw = m.modifiedFromRawMessage ?? m.content;
                            return typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
                          })()}
                        </pre>
                      </Show>
                      <div class="hidden group-hover:flex absolute bottom-2 right-2">
                        <MessageActions
                          index={index()}
                          showingRaw={rawIds().has(m.id)}
                          hasDebug={Boolean(m.debug)}
                          showingDebug={debugIds().has(m.id)}
                          onFork={forkFrom}
                          onRevert={revertTo}
                          onToggleRaw={toggleRaw}
                          onToggleDebug={toggleDebug}
                        />
                      </div>
                    </div>
                    <Show when={showDebug()}>
                      <div class={`mt-2 max-h-100 overflow-y-auto overflow-x-hidden rounded-md ${showDebug() ? 'xl:flex-[1_1_0%] xl:max-w-[25%] xl:m-0 xl:max-h-none' : ''}`}>
                        <DebugPanel
                          debug={m.debug!}
                          convUsage={activeConv.usage}
                          messageCount={debugMessageCount()}
                        />
                      </div>
                    </Show>
                  </div>
                </div>
                </Show>
                );
              }}
            </For>
            <Show when={error()}>
              <div class="text-red-700 bg-red-50 py-2.5 px-3.5 rounded-lg text-sm">{error()}</div>
            </Show>
          </main>

          <footer class="pt-3 px-5 pb-4 border-t border-gray-200 flex-shrink-0">
            <div class="flex gap-2">
              <textarea
                ref={textareaRef}
                class="flex-1 resize-none border border-gray-300 rounded-lg py-2.5 px-3 font-[inherit] text-sm outline-none w-full box-border focus:border-gray-500"
                placeholder={`Message ${agent().name}…  (Enter to send, Shift+Enter for newline)`}
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                disabled={busy()}
                rows={3}
              />
              <button
                class="border-none bg-gray-900 text-white px-5 rounded-lg cursor-pointer text-sm font-medium flex-shrink-0 disabled:bg-gray-300 disabled:cursor-not-allowed"
                onClick={send}
                disabled={busy() || !input().trim()}
              >
                {busy() ? '…' : 'Send'}
              </button>
            </div>
          </footer>
        </div>

        <Show when={planOpen()}>
          <LessonPlan
            plans={activeConv.plans}
            onSave={updatePlan}
            onClose={() => setPlanOpen(false)}
          />
        </Show>
      </Show>
    </div>
  );
};

const KeyGate: Component<{ onSave: (key: string) => void }> = (props) => {
  const [value, setValue] = createSignal('');
  return (
    <div class="w-full flex flex-col items-start max-w-110 my-20 mx-auto p-8 gap-3 box-border">
      <h1 class="m-0 text-4xl font-light tracking-tight text-green-900">chalk</h1>
      <p class="text-gray-500 m-0 mb-2 leading-normal text-sm">
        Bring your own Anthropic API key. Stored in localStorage, sent
        directly to <code class="bg-gray-100 py-0.5 px-1.5 rounded-sm text-[0.9em]">api.anthropic.com</code>. No backend.
      </p>
      <input
        class="border border-gray-300 rounded-lg py-2.5 px-3 font-[inherit] outline-none w-full box-border focus:border-gray-500"
        type="password"
        placeholder="sk-ant-…"
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value().trim()) props.onSave(value().trim());
        }}
      />
      <button
        class="border-none bg-gray-900 text-white py-2.5 px-4 rounded-lg cursor-pointer text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
        disabled={!value().trim()}
        onClick={() => props.onSave(value().trim())}
      >
        Save & start chatting
      </button>
      <p class="text-sm text-gray-500 mt-1">
        Get a key at{' '}
        <a
          class="text-gray-600"
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noreferrer"
        >
          console.anthropic.com
        </a>
      </p>
    </div>
  );
};

export default App;
