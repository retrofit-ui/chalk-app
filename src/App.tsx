import { createEffect, createSignal, For, Show, type Component } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  clearStoredKey,
  getStoredKey,
  isKeyFromEnv,
  makeClient,
  setStoredKey,
  type ChatMessage,
} from './anthropic';
import {
  deriveTitle,
  extractPlanBlock,
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
import ada from './agents/ada/index';
import LessonPlan from './components/LessonPlan';
import MessageActions from './components/MessageActions';
import ReplyBox from './components/ReplyBox';
import Sidebar from './Sidebar';
import styles from './App.module.css';

const AGENT = ada;

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

  const startNew = () => activateConv(newConversation(activeConv.model));

  const selectConv = (conv: Conversation) => activateConv(conv);

  const selectExample = (example: Conversation) => {
    const conv = newConversation(activeConv.model);
    conv.title = example.title;
    activateConv(conv);
    setInput(example.messages[0]?.content ?? '');
    setTimeout(() => textareaRef?.focus(), 0);
  };

  const setModel = (model: string) => {
    setActiveConv('model', model);
    upsertConversation({ ...activeConv });
  };

  const forkFrom = (messageIndex: number) => {
    const forked = forkConversation({ ...activeConv }, messageIndex);
    upsertConversation(forked);
    activateConv(forked);
    refreshList();
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

  const send = async () => {
    const key = apiKey();
    const text = input().trim();
    if (!key || !text || busy()) return;

    setError(null);
    setInput('');
    setBusy(true);

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();

    setActiveConv('messages', produce((m: ChatMessage[]) => {
      m.push({ id: userMsgId, role: 'user', content: text });
      m.push({ id: assistantMsgId, role: 'assistant', content: '' });
    }));
    const assistantIdx = activeConv.messages.length - 1;

    if (assistantIdx === 1) {
      setActiveConv('title', deriveTitle(activeConv.messages));
    }

    setActiveConv('updatedAt', Date.now());
    upsertConversation({ ...activeConv });
    setActiveId(activeConv.id);
    refreshList();

    try {
      const client = makeClient(key);
      const model = activeConv.model ?? DEFAULT_MODEL;
      const stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system: AGENT.systemPrompt,
        messages: activeConv.messages
          .slice(0, assistantIdx)
          .map((m) => ({ role: m.role, content: m.content })),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          setActiveConv('messages', assistantIdx, 'content', (c: string) => c + event.delta.text);
        }
      }

      // Check for >>PLAN<< block after streaming completes
      const rawContent = activeConv.messages[assistantIdx].content;
      const { plan, reply } = extractPlanBlock(rawContent);
      if (plan !== null) {
        setActiveConv('messages', assistantIdx, 'modifiedFromRawMessage', rawContent);
        setActiveConv('messages', assistantIdx, 'content', reply);
        setActiveConv('plans', produce((ps: string[]) => { ps.push(plan); }));
      }

      setActiveConv('messages', assistantIdx, 'model', model);
      setActiveConv('updatedAt', Date.now());
      upsertConversation({ ...activeConv });
      refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setActiveConv('messages', produce((m: ChatMessage[]) => { m.pop(); }));
      upsertConversation({ ...activeConv });
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div class={styles.shell}>
      <Show when={apiKey()} fallback={<KeyGate onSave={saveKey} />}>
        <Sidebar
          conversations={convList()}
          activeId={activeConv.id}
          childMap={childMap()}
          onNew={startNew}
          onSelect={selectConv}
          onSelectExample={selectExample}
        />

        <div class={styles.main}>
          <header class={styles.header}>
            <span class={styles.convTitle}>{activeConv.title}</span>
            <button
              class={styles.planBtn}
              title="View lesson plan"
              onClick={() => setPlanOpen((o) => !o)}
            >
              {activeConv.plans.length > 0 ? 'ⓘ' : '○'}
            </button>
            <div class={styles.headerMeta}>
              <span class={styles.systemBadge}>{AGENT.name} {AGENT.version}</span>
              <select
                class={styles.modelSelect}
                value={activeConv.model}
                onChange={(e) => setModel(e.currentTarget.value)}
                disabled={busy()}
              >
                <For each={AVAILABLE_MODELS}>
                  {(m) => <option value={m}>{m}</option>}
                </For>
              </select>
            </div>
            <div class={styles.headerActions}>
              <Show when={!isKeyFromEnv()}>
                <button class={styles.linkBtn} onClick={forgetKey}>
                  clear key
                </button>
              </Show>
            </div>
          </header>

          <main ref={messagesRef} class={styles.messages}>
            <Show when={activeConv.messages.length === 0 && !input()}>
              <div class={styles.empty}>Say something to {AGENT.name}.</div>
            </Show>
            <For each={activeConv.messages} keyed>
              {(m, index) => (
                <Show when={m.content || m.modifiedFromRawMessage}>
                  <div class={`${styles.msg} msg`}>
                    <div class={styles.role}>
                      {m.role === 'assistant' ? AGENT.name.toLowerCase() : 'you'}
                      <Show when={m.model}>
                        <span class={styles.msgModel}> · {m.model}</span>
                      </Show>
                    </div>
                    <div class={styles.msgBody}>
                      <Show
                        when={m.role === 'assistant'}
                        fallback={<AGENT.Harness message={m} />}
                      >
                        <ReplyBox>
                          <AGENT.Harness message={m} />
                        </ReplyBox>
                      </Show>
                      <div class={styles.msgActions}>
                        <MessageActions
                          index={index()}
                          onFork={forkFrom}
                          onRevert={revertTo}
                        />
                      </div>
                    </div>
                  </div>
                </Show>
              )}
            </For>
            <Show when={error()}>
              <div class={styles.error}>{error()}</div>
            </Show>
          </main>

          <footer class={styles.composer}>
            <div class={styles.composerRow}>
              <textarea
                ref={textareaRef}
                class={styles.textarea}
                placeholder={`Message ${AGENT.name}…  (Enter to send, Shift+Enter for newline)`}
                value={input()}
                onInput={(e) => setInput(e.currentTarget.value)}
                onKeyDown={onKeyDown}
                disabled={busy()}
                rows={3}
              />
              <button
                class={styles.sendBtn}
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
    <div class={styles.gate}>
      <h1 class={styles.gateTitle}>गणित</h1>
      <p class={styles.gateSub}>
        Bring your own Anthropic API key. Stored in localStorage, sent
        directly to <code>api.anthropic.com</code>. No backend.
      </p>
      <input
        class={styles.gateInput}
        type="password"
        placeholder="sk-ant-…"
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value().trim()) props.onSave(value().trim());
        }}
      />
      <button
        class={styles.gateBtn}
        disabled={!value().trim()}
        onClick={() => props.onSave(value().trim())}
      >
        Save & start chatting
      </button>
      <p class={styles.gateHint}>
        Get a key at{' '}
        <a
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
